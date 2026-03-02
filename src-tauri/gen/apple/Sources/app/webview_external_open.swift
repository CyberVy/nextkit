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
    private let popupWebView: WKWebView
    private lazy var closeButton = UIBarButtonItem(
        barButtonSystemItem: .close,
        target: self,
        action: #selector(closeTapped)
    )
    private lazy var backButton = UIBarButtonItem(
        title: "Back",
        style: .plain,
        target: self,
        action: #selector(goBack)
    )
    private lazy var forwardButton = UIBarButtonItem(
        title: "Forward",
        style: .plain,
        target: self,
        action: #selector(goForward)
    )
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

        applyNoFlickerStyle(to: popupWebView, in: self)
        popupWebView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(popupWebView)
        NSLayoutConstraint.activate([
            popupWebView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            popupWebView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            popupWebView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            popupWebView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        navigationItem.leftBarButtonItem = closeButton
        navigationItem.rightBarButtonItems = [forwardButton, backButton]
        closeOnEdgeSwipeGesture.edges = .left
        closeOnEdgeSwipeGesture.delegate = self
        closeOnEdgeSwipeGesture.cancelsTouchesInView = false
        closeOnEdgeSwipeGesture.addTarget(self, action: #selector(handleCloseOnEdgeSwipe(_:)))
        view.addGestureRecognizer(closeOnEdgeSwipeGesture)
        updateNavigationButtons()
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

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        updateNavigationButtons()
    }

    // Use WebKit's internal "allow without App Link" policy to keep Universal Links in-app.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        decisionHandler(allowWithoutTryingAppLinkPolicy(), preferences)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        title = webView.title
        updateNavigationButtons()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        updateNavigationButtons()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        updateNavigationButtons()
    }

    private func updateNavigationButtons() {
        backButton.isEnabled = popupWebView.canGoBack
        forwardButton.isEnabled = popupWebView.canGoForward
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
        isolatePopupUserContentControllerIfNeeded(
            hostConfiguration: webView.configuration,
            popupConfiguration: configuration
        )
        installExternalInjectScript(on: configuration)

        let popupWebView = WKWebView(frame: .zero, configuration: configuration)
        popupWebView.customUserAgent = webView.customUserAgent
        popupWebView.allowsBackForwardNavigationGestures = webView.allowsBackForwardNavigationGestures
        popupWebView.uiDelegate = self

        let popupController = PopupWebViewController(webView: popupWebView)
        // Install navigation delegate before returning the popup webview, so the
        // very first navigation can be intercepted.
        popupWebView.navigationDelegate = popupController
        let navigationController = UINavigationController(rootViewController: popupController)
        navigationController.modalPresentationStyle = .overFullScreen
        navigationController.view.backgroundColor = .clear

        popupControllers.setObject(navigationController, forKey: popupWebView)
        controller.present(navigationController, animated: true)
        return popupWebView
    }

    func webViewDidClose(_ webView: WKWebView) {
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
