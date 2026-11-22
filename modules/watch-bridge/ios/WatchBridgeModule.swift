import ExpoModulesCore
import WatchConnectivity

/// Sends the game snapshot to the Apple Watch and queues the watch's button presses (Feed, +1 water)
/// until the game's JavaScript picks them up, even if they arrived while the app was closed.
public class WatchBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchBridge")
    Events("onWatchAction")

    OnCreate {
      WatchSessionHub.shared.onAction = { [weak self] in
        self?.sendEvent("onWatchAction", [:])
      }
      WatchSessionHub.shared.activate()
    }

    Function("isAvailable") { () -> Bool in
      WatchSessionHub.shared.isAvailable
    }

    Function("updateContext") { (json: String) in
      WatchSessionHub.shared.update(json: json)
    }

    Function("takePending") { () -> [String] in
      WatchSessionHub.shared.takePending()
    }
  }
}

final class WatchSessionHub: NSObject, WCSessionDelegate {
  static let shared = WatchSessionHub()
  var onAction: (() -> Void)?
  private var latest: String?
  private let pendingKey = "sproutling.watch.pending"
  private let lock = NSLock()

  var isAvailable: Bool {
    guard WCSession.isSupported() else { return false }
    let s = WCSession.default
    return s.activationState == .activated && s.isPaired && s.isWatchAppInstalled
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    if s.delegate == nil { s.delegate = self }
    if s.activationState != .activated { s.activate() }
  }

  func update(json: String) {
    lock.lock(); latest = json; lock.unlock()
    push()
  }

  private func push() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    lock.lock(); let json = latest; lock.unlock()
    guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled, let json else { return }
    try? s.updateApplicationContext(["state": json, "at": Date().timeIntervalSince1970])
  }

  // MARK: - Button presses from the watch

  private func enqueue(_ payload: [String: Any]) {
    guard let action = payload["action"] as? String else { return }
    lock.lock()
    var list = UserDefaults.standard.stringArray(forKey: pendingKey) ?? []
    list.append(action)
    UserDefaults.standard.set(Array(list.suffix(20)), forKey: pendingKey)
    lock.unlock()
    DispatchQueue.main.async { self.onAction?() }
  }

  func takePending() -> [String] {
    lock.lock(); defer { lock.unlock() }
    let list = UserDefaults.standard.stringArray(forKey: pendingKey) ?? []
    UserDefaults.standard.removeObject(forKey: pendingKey)
    return list
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated { push() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Switching to another watch: activate again for the new one.
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    push()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    enqueue(message)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    enqueue(message)
    replyHandler(["ok": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    enqueue(userInfo)
  }
}
