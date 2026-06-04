import UIKit
import WebKit
import ObjectiveC.runtime

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
        popupWebView.tintColor = webView.tintColor
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
