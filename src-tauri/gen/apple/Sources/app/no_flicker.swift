import UIKit
import WebKit

@_cdecl("on_webview_created")
public func on_webview_created(_ webviewPtr: UnsafeRawPointer?, _ controllerPtr: UnsafeRawPointer?) {
    guard let webviewPtr, let controllerPtr else { return }

    let webview = Unmanaged<WKWebView>.fromOpaque(webviewPtr).takeUnretainedValue()
    let controller = Unmanaged<UIViewController>.fromOpaque(controllerPtr).takeUnretainedValue()

    let bg = UIColor.systemBackground

    controller.view.backgroundColor = bg
    webview.isOpaque = false
    webview.backgroundColor = bg
    webview.scrollView.backgroundColor = bg

    // Enable edge-swipe back/forward like Safari.
    webview.allowsBackForwardNavigationGestures = true
}
