#[cfg(target_os = "macos")]
use objc2::{
    msg_send,
    rc::Retained,
    runtime::{AnyClass, AnyObject},
};

pub fn disable() {
    #[cfg(target_os = "macos")]
    unsafe {
        let cls = AnyClass::get(c"WKWebsiteDataStore").expect("WKWebsiteDataStore not found");
        let store: Retained<AnyObject> = msg_send![cls, defaultDataStore];
        let _: () = msg_send![&store, _setResourceLoadStatisticsEnabled: false];
    }
}
