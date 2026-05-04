import UIKit
import WebKit
import ObjectiveC.runtime

private let appBoundDomainSet: Set<String> = {
    let raw = Bundle.main.object(forInfoDictionaryKey: "WKAppBoundDomains") as? [String] ?? []
    return Set(raw.map { $0.lowercased() })
}()

private func shouldEnableAppBound(for url: URL?) -> Bool {
    guard let host = url?.host?.lowercased() else { return false }
    return appBoundDomainSet.contains(host)
}

// static const WKNavigationActionPolicy WK_API_AVAILABLE(macos(10.11), ios(9.0)) _WKNavigationActionPolicyAllowWithoutTryingAppLink = (WKNavigationActionPolicy)(WKNavigationActionPolicyAllow + 2);
// according to https://github.com/WebKit/WebKit/blob/995f6b1595611c934e742a4f3a9af2e678bc6b8d/Source/WebKit/UIProcess/API/Cocoa/WKNavigationDelegatePrivate.h#L61
private func allowWithoutTryingAppLinkPolicy() -> WKNavigationActionPolicy {
    if let policy = WKNavigationActionPolicy(rawValue: WKNavigationActionPolicy.allow.rawValue + 2) {
        return policy
    }
    return .allow
}

private final class PopupWebViewController: UIViewController, WKNavigationDelegate, UIGestureRecognizerDelegate {
    private let closeSwipeProgressThreshold: CGFloat = 0.5
    private let closeSwipeMaxDistanceThreshold: CGFloat = 240
    private let toolbarHorizontalInset: CGFloat = 14
    private let toolbarBottomSpacing: CGFloat = 12
    private let toolbarContentInset = NSDirectionalEdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
    private let toolbarButtonSize: CGFloat = 36
    private let popupWebView: WKWebView
    private let toolbarView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
    private let titleLabel = UILabel()
    private let navButtons = UIStackView()
    private let contentStack = UIStackView()
    private var titleMinimumWidthConstraint: NSLayoutConstraint?
    private var isToolbarCollapsed = false
    private var observations: [NSKeyValueObservation] = []
    private lazy var closeButton = makeToolbarButton(symbolName: "xmark", action: #selector(closeTapped))
    private lazy var backButton = makeToolbarButton(symbolName: "chevron.left", action: #selector(goBack))
    private lazy var forwardButton = makeToolbarButton(symbolName: "chevron.right", action: #selector(goForward))
    private lazy var collapseButton = makeToolbarButton(symbolName: "chevron.down", action: #selector(toggleToolbarCollapsed))
    private let closeOnEdgeSwipeGesture = UIScreenEdgePanGestureRecognizer()

    init(webView: WKWebView) {
        self.popupWebView = webView
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        setupObservations()
        applyNoFlickerStyle(to: popupWebView, in: self)
        popupWebView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(popupWebView)
        NSLayoutConstraint.activate([
            popupWebView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            popupWebView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            popupWebView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            popupWebView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        configureToolbar()
        updateWebViewInsets()
        closeOnEdgeSwipeGesture.edges = .left
        closeOnEdgeSwipeGesture.delegate = self
        closeOnEdgeSwipeGesture.cancelsTouchesInView = false
        closeOnEdgeSwipeGesture.addTarget(self, action: #selector(handleCloseOnEdgeSwipe(_:)))
        view.addGestureRecognizer(closeOnEdgeSwipeGesture)
        updateNavigationButtons()
        updateDisplayedTitle()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateWebViewInsets()
    }

    @objc private func closeTapped() {
        dismiss(animated: true)
    }

    @objc private func goBack() {
        popupWebView.goBack()
    }

    @objc private func goForward() {
        popupWebView.goForward()
    }

    @objc private func toggleToolbarCollapsed() {
        isToolbarCollapsed.toggle()
        applyToolbarCollapsedState(animated: true)
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === closeOnEdgeSwipeGesture else { return true }
        // Only enable the close swipe when there is no web history to go back to.
        return !popupWebView.canGoBack
    }

    @objc private func handleCloseOnEdgeSwipe(_ recognizer: UIScreenEdgePanGestureRecognizer) {
        // Re-check at trigger time in case navigation state changed mid-gesture.
        guard !popupWebView.canGoBack else { return }

        let container: UIView = navigationController?.view ?? self.view
        let width = max(container.bounds.width, 1)
        let translationX = max(recognizer.translation(in: container).x, 0)
        let progress = min(translationX / width, 1)

        switch recognizer.state {
        case .began, .changed:
            container.transform = CGAffineTransform(translationX: translationX, y: 0)
            container.alpha = 1 - (0.25 * progress)

        case .ended:
            let closeDistance = min(width * closeSwipeProgressThreshold, closeSwipeMaxDistanceThreshold)
            if translationX >= closeDistance {
                animateSwipeContainer(container, x: width, alpha: 0.75, duration: 0.2) { [weak self] in
                    self?.dismiss(animated: false) {
                        container.transform = .identity
                        container.alpha = 1
                    }
                }
            } else {
                animateSwipeContainer(container, x: 0, alpha: 1, duration: 0.22)
            }

        case .cancelled, .failed:
            animateSwipeContainer(container, x: 0, alpha: 1, duration: 0.18)

        default:
            break
        }
    }

    private func animateSwipeContainer(_ container: UIView, x: CGFloat, alpha: CGFloat, duration: TimeInterval, completion: (() -> Void)? = nil) {
        UIView.animate(withDuration: duration, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            container.transform = CGAffineTransform(translationX: x, y: 0)
            container.alpha = alpha
        } completion: { _ in
            completion?()
        }
    }

    private func setupObservations() {
        observations = [
            popupWebView.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in
                self?.updateNavigationButtons()
            },
            popupWebView.observe(\.canGoForward, options: [.new]) { [weak self] _, _ in
                self?.updateNavigationButtons()
            },
            popupWebView.observe(\.title, options: [.new]) { [weak self] _, _ in
                self?.updateDisplayedTitle()
            },
            popupWebView.observe(\.url, options: [.new]) { [weak self] _, _ in
                self?.updateDisplayedTitle()
            }
        ]
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        // KVO handles UI updates
    }

    // Use WebKit's internal "allow without App Link" policy to keep Universal Links in-app.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        decisionHandler(allowWithoutTryingAppLinkPolicy(), preferences)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // KVO handles UI updates
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        // KVO handles UI updates
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        // KVO handles UI updates
    }

    private func updateNavigationButtons() {
        updateButtonState(backButton, enabled: popupWebView.canGoBack)
        updateButtonState(forwardButton, enabled: popupWebView.canGoForward)
    }

    private func configureToolbar() {
        toolbarView.translatesAutoresizingMaskIntoConstraints = false
        toolbarView.layer.cornerRadius = 22
        toolbarView.layer.cornerCurve = .continuous
        toolbarView.layer.masksToBounds = true
        toolbarView.layer.borderWidth = 1 / UIScreen.main.scale
        toolbarView.layer.borderColor = UIColor.white.withAlphaComponent(0.18).cgColor

        let blurEffect = (toolbarView.effect as? UIBlurEffect) ?? UIBlurEffect(style: .systemChromeMaterial)
        let vibrancyView = UIVisualEffectView(effect: UIVibrancyEffect(blurEffect: blurEffect))
        vibrancyView.translatesAutoresizingMaskIntoConstraints = false
        toolbarView.contentView.addSubview(vibrancyView)
        NSLayoutConstraint.activate([
            vibrancyView.leadingAnchor.constraint(equalTo: toolbarView.contentView.leadingAnchor),
            vibrancyView.trailingAnchor.constraint(equalTo: toolbarView.contentView.trailingAnchor),
            vibrancyView.topAnchor.constraint(equalTo: toolbarView.contentView.topAnchor),
            vibrancyView.bottomAnchor.constraint(equalTo: toolbarView.contentView.bottomAnchor)
        ])

        navButtons.axis = .horizontal
        navButtons.alignment = .center
        navButtons.spacing = 8
        navButtons.translatesAutoresizingMaskIntoConstraints = false
        navButtons.addArrangedSubview(backButton)
        navButtons.addArrangedSubview(forwardButton)

        titleLabel.font = .preferredFont(forTextStyle: .subheadline)
        titleLabel.textAlignment = .center
        titleLabel.textColor = .label
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        titleLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        contentStack.axis = .horizontal
        contentStack.alignment = .center
        contentStack.spacing = 12
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.addArrangedSubview(closeButton)
        contentStack.addArrangedSubview(titleLabel)
        contentStack.addArrangedSubview(navButtons)
        contentStack.addArrangedSubview(collapseButton)

        vibrancyView.contentView.addSubview(contentStack)
        view.addSubview(toolbarView)

        NSLayoutConstraint.activate([
            toolbarView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: toolbarHorizontalInset),
            toolbarView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -toolbarHorizontalInset),
            toolbarView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toolbarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -toolbarBottomSpacing),

            contentStack.leadingAnchor.constraint(equalTo: vibrancyView.contentView.leadingAnchor, constant: toolbarContentInset.leading),
            contentStack.trailingAnchor.constraint(equalTo: vibrancyView.contentView.trailingAnchor, constant: -toolbarContentInset.trailing),
            contentStack.topAnchor.constraint(equalTo: vibrancyView.contentView.topAnchor, constant: toolbarContentInset.top),
            contentStack.bottomAnchor.constraint(equalTo: vibrancyView.contentView.bottomAnchor, constant: -toolbarContentInset.bottom),

            closeButton.widthAnchor.constraint(equalToConstant: toolbarButtonSize),
            closeButton.heightAnchor.constraint(equalToConstant: toolbarButtonSize),
            backButton.widthAnchor.constraint(equalToConstant: toolbarButtonSize),
            backButton.heightAnchor.constraint(equalToConstant: toolbarButtonSize),
            forwardButton.widthAnchor.constraint(equalToConstant: toolbarButtonSize),
            forwardButton.heightAnchor.constraint(equalToConstant: toolbarButtonSize),
            collapseButton.widthAnchor.constraint(equalToConstant: toolbarButtonSize),
            collapseButton.heightAnchor.constraint(equalToConstant: toolbarButtonSize)
        ])

        titleMinimumWidthConstraint = titleLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 120)
        titleMinimumWidthConstraint?.isActive = true
        applyToolbarCollapsedState(animated: false)
    }

    private func makeToolbarButton(symbolName: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.tintColor = .label
        button.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.55)
        button.layer.cornerRadius = toolbarButtonSize / 2
        button.layer.cornerCurve = .continuous
        button.layer.borderWidth = 1 / UIScreen.main.scale
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor
        button.setImage(UIImage(systemName: symbolName), for: .normal)
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    private func updateButtonState(_ button: UIButton, enabled: Bool) {
        button.isEnabled = enabled
        button.alpha = enabled ? 1 : 0.42
    }

    private func applyToolbarCollapsedState(animated: Bool) {
        let updates = {
            self.titleLabel.isHidden = self.isToolbarCollapsed
            self.navButtons.isHidden = self.isToolbarCollapsed
            self.titleMinimumWidthConstraint?.isActive = !self.isToolbarCollapsed

            let symbolName = self.isToolbarCollapsed ? "chevron.up" : "chevron.down"
            self.collapseButton.setImage(UIImage(systemName: symbolName), for: .normal)
            self.view.layoutIfNeeded()
        }

        if animated {
            UIView.animate(withDuration: 0.2, delay: 0, options: [.curveEaseOut, .allowUserInteraction], animations: updates)
        } else {
            updates()
        }
    }

    private func updateDisplayedTitle() {
        let fallbackTitle = popupWebView.url?.host?.replacingOccurrences(of: "www.", with: "") ?? "Loading..."
        let currentTitle = popupWebView.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        titleLabel.text = (currentTitle?.isEmpty == false) ? currentTitle : fallbackTitle
    }

    private func updateWebViewInsets() {
        popupWebView.scrollView.contentInsetAdjustmentBehavior = .never
        popupWebView.scrollView.contentInset = .zero
        popupWebView.scrollView.scrollIndicatorInsets = .zero
    }
}

/// Handles `window.open` / target `_blank` with an in-app WKWebView popup that shares cookies.
final class ExternalOpenUIDelegate: NSObject, WKUIDelegate {
    private weak var hostController: UIViewController?
    private let popupControllers = NSMapTable<WKWebView, UIViewController>(
        keyOptions: .weakMemory,
        valueOptions: .weakMemory
    )

    init(hostController: UIViewController) {
        self.hostController = hostController
        super.init()
    }

    /// Intercept requests that would create a new window and present an in-app WKWebView.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil,
              let controller = topMostController() else {
            return nil
        }

        // Share the same cookie/process context as the main WKWebView.
        configuration.processPool = webView.configuration.processPool
        configuration.websiteDataStore = webView.configuration.websiteDataStore
        if #available(iOS 14.0, *) {
            let enableAppBound = shouldEnableAppBound(for: navigationAction.request.url)
            configuration.limitsNavigationsToAppBoundDomains = enableAppBound
        }
        // Keep the same WKUserContentController from configuration as the host webview so Wry/Tauri
        // script message handlers and initialization scripts remain available in popup.
        // iOS-side extra inject script is intentionally disabled; all inject logic is centralized in Rust/Tauri.
        let popupWebView = WKWebView(frame: .zero, configuration: configuration)
        popupWebView.customUserAgent = webView.customUserAgent
        popupWebView.allowsBackForwardNavigationGestures = webView.allowsBackForwardNavigationGestures
        popupWebView.uiDelegate = self

        let popupController = PopupWebViewController(webView: popupWebView)
        // Install navigation delegate before returning the popup webview, so the
        // very first navigation can be intercepted.
        popupWebView.navigationDelegate = popupController
        popupController.modalPresentationStyle = .overFullScreen
        popupController.modalTransitionStyle = .coverVertical

        popupControllers.setObject(popupController, forKey: popupWebView)
        controller.present(popupController, animated: true)
        installFullPageScreenshot(webView: popupWebView)
        return popupWebView
    }

    func webViewDidClose(_ webView: WKWebView) {
        uninstallFullPageScreenshot(webView: webView)
        guard let controller = popupControllers.object(forKey: webView) else { return }
        controller.dismiss(animated: true)
        popupControllers.removeObject(forKey: webView)
    }

    private func topMostController() -> UIViewController? {
        guard let hostController else { return nil }
        var top = hostController
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}

private var uiDelegateKey: UInt8 = 0

/// Attach the delegate and retain it via associated object to avoid deallocation.
func installExternalOpenDelegate(webView: WKWebView, controller: UIViewController) {
    let delegate = ExternalOpenUIDelegate(hostController: controller)
    webView.uiDelegate = delegate
    objc_setAssociatedObject(webView, &uiDelegateKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
}
