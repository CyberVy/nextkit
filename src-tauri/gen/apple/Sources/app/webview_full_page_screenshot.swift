import UIKit
import WebKit

private class ScreenshotManager: NSObject, UIScreenshotServiceDelegate {
    static var shared: ScreenshotManager?

    private var webViews: [WeakWebViewBox] = []

    private class WeakWebViewBox {
        weak var webView: WKWebView?
        init(_ webView: WKWebView) { self.webView = webView }
    }

    func install(_ webView: WKWebView) {
        webViews.removeAll { $0.webView == nil }
        guard !webViews.contains(where: { $0.webView === webView }) else { return }
        webViews.append(WeakWebViewBox(webView))
    }

    func uninstall(_ webView: WKWebView) {
        webViews.removeAll { $0.webView === webView || $0.webView == nil }
    }

    private func resolveActiveWebView() -> WKWebView? {
        webViews.removeAll { $0.webView == nil }
        return webViews.last?.webView
    }

    func screenshotService(_ screenshotService: UIScreenshotService, generatePDFRepresentationWithCompletion completionHandler: @escaping (Data?, Int, CGRect) -> Void) {
        guard #available(iOS 14.0, *),
              let webView = resolveActiveWebView() else {
            completionHandler(nil, 0, .zero)
            return
        }
        webView.createPDF(configuration: WKPDFConfiguration()) { result in
            switch result {
            case .success(let data): completionHandler(data, 0, .zero)
            case .failure:           completionHandler(nil, 0, .zero)
            }
        }
    }
}

func installFullPageScreenshot(webView: WKWebView, controller: UIViewController) {
    if ScreenshotManager.shared == nil {
        if #available(iOS 14.0, *) {
            let manager = ScreenshotManager()
            ScreenshotManager.shared = manager
            controller.view.window?.windowScene?.screenshotService?.delegate = manager
        }
    }
    ScreenshotManager.shared?.install(webView)
}

func installFullPageScreenshot(webView: WKWebView) {
    ScreenshotManager.shared?.install(webView)
}

func uninstallFullPageScreenshot(webView: WKWebView) {
    ScreenshotManager.shared?.uninstall(webView)
}
