#if defined(__APPLE__)

#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <Setapp/Setapp.h>

namespace {

STPManager *sharedManager() {
    Class managerClass = NSClassFromString(@"STPManager");
    if (managerClass == Nil) {
        return nil;
    }

    return [STPManager sharedInstance];
}

BOOL setappIsRunningWithValidAccess(STPManager *manager) {
    if (manager == nil) {
        return NO;
    }

    STPSubscription *subscription = manager.subscription;
    if (subscription == nil) {
        // On macOS, Setapp Launch controls execution before the app starts.
        return YES;
    }

    return subscription.isActive;
}

}  // namespace

extern "C" bool filearchitect_setapp_is_available() {
    return sharedManager() != nil;
}

extern "C" bool filearchitect_setapp_is_active() {
    return setappIsRunningWithValidAccess(sharedManager());
}

extern "C" int filearchitect_setapp_purchase_type() {
    // requestPurchaseType is Swift-only in the current SDK surface.
    return 0;
}

extern "C" long long filearchitect_setapp_expiration_timestamp() {
    STPManager *manager = sharedManager();
    if (manager == nil || manager.subscription == nil || manager.subscription.expirationDate == nil) {
        return 0;
    }

    return (long long)[manager.subscription.expirationDate timeIntervalSince1970];
}

extern "C" bool filearchitect_setapp_show_release_notes_if_needed() {
    STPManager *manager = sharedManager();
    if (manager == nil) {
        return false;
    }

    [manager showReleaseNotesWindowIfNeeded];
    return true;
}

extern "C" bool filearchitect_setapp_show_release_notes() {
    STPManager *manager = sharedManager();
    if (manager == nil) {
        return false;
    }

    [manager showReleaseNotesWindow];
    return true;
}

extern "C" bool filearchitect_setapp_report_usage_event(int usageEvent) {
    STPManager *manager = sharedManager();
    if (manager == nil) {
        return false;
    }

    [manager reportUsageEvent:(STPUsageEvent)usageEvent];
    return true;
}

#endif
