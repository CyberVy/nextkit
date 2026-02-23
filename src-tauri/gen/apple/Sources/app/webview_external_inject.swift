import Foundation
import WebKit

private var externalInjectScriptCache: String? = nil

private func loadExternalInjectScript() -> String? {
    if let cached = externalInjectScriptCache {
        return cached
    }

    guard let scriptURL = Bundle.main.url(
        forResource: "webview_external_inject",
        withExtension: "js",
        subdirectory: "assets"
    ) else {
        return nil
    }

    guard let script = try? String(contentsOf: scriptURL, encoding: .utf8) else {
        return nil
    }

    let trimmed = script.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        return nil
    }

    externalInjectScriptCache = trimmed
    return trimmed
}

// Popup can share the same WKUserContentController as the host webview.
// If we inject directly in that case, the script can also run in the host (e.g. host iframes).
// So we clone existing scripts into an isolated controller for popup before injecting.
func isolatePopupUserContentControllerIfNeeded(
    hostConfiguration: WKWebViewConfiguration,
    popupConfiguration: WKWebViewConfiguration
) {
    let shared = popupConfiguration.userContentController === hostConfiguration.userContentController
    guard shared else {
        return
    }

    let isolatedController = WKUserContentController()
    for script in hostConfiguration.userContentController.userScripts {
        isolatedController.addUserScript(script)
    }
    popupConfiguration.userContentController = isolatedController
}

func installExternalInjectScript(on configuration: WKWebViewConfiguration) {
    let userContentController = configuration.userContentController
    guard let script = loadExternalInjectScript() else {
        return
    }

    userContentController.addUserScript(
        WKUserScript(
            source: script,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
    )
}
