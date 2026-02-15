import UIKit
import WebKit
import ObjectiveC.runtime

private final class PopupWebViewController: UIViewController, WKNavigationDelegate {
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

        popupWebView.navigationDelegate = self
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

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        updateNavigationButtons()
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

        let popupWebView = WKWebView(frame: .zero, configuration: configuration)
        popupWebView.customUserAgent = webView.customUserAgent
        popupWebView.allowsBackForwardNavigationGestures = false
        popupWebView.uiDelegate = self

        let popupController = PopupWebViewController(webView: popupWebView)
        let navigationController = UINavigationController(rootViewController: popupController)
        navigationController.modalPresentationStyle = .fullScreen

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
