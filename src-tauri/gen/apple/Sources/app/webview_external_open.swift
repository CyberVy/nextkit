import UIKit
import WebKit
import SafariServices
import ObjectiveC.runtime

/// Handles `window.open` / target `_blank` so the current WKWebView stays on its page.
final class ExternalOpenUIDelegate: NSObject, WKUIDelegate {
    private weak var hostController: UIViewController?

    init(hostController: UIViewController) {
        self.hostController = hostController
        super.init()
    }

    /// Intercept requests that would create a new window and open them in an in-app Safari view.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil,
              let url = navigationAction.request.url else {
            return nil
        }

        openURL(url)
        // Returning nil tells WKWebView we handled it; current page stays loaded.
        return nil
    }

    private func openURL(_ url: URL) {
        // In-app Safari keeps user inside app and avoids unloading current WKWebView.
        guard let controller = hostController else { return }
        let safari = SFSafariViewController(url: url)
        controller.present(safari, animated: true)
    }
}

private var uiDelegateKey: UInt8 = 0

/// Attach the delegate and retain it via associated object to avoid deallocation.
func installExternalOpenDelegate(webView: WKWebView, controller: UIViewController) {
    let delegate = ExternalOpenUIDelegate(hostController: controller)
    webView.uiDelegate = delegate
    objc_setAssociatedObject(webView, &uiDelegateKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
}

