import Foundation
import HealthKit
import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

/// Holds what the watch shows: the game snapshot from the iPhone plus live steps read on the watch.
@MainActor
final class WatchStore: NSObject, ObservableObject {
  @Published var snap: Snapshot?
  @Published var liveSteps: Int = Shared.liveSteps
  @Published var celebrate = false

  private let health = HKHealthStore()
  private var observer: HKObserverQuery?
  private var lastReload = Date.distantPast

  override init() {
    super.init()
    snap = Shared.loadSnapshot()
    if WCSession.isSupported() {
      let s = WCSession.default
      s.delegate = self
      s.activate()
    }
  }

  var steps: Int { max(liveSteps, (snap?.day == Shared.todayKey()) ? (snap?.steps ?? 0) : 0) }
  var goal: Int { max(1, snap?.goal ?? 8000) }

  // MARK: - Steps

  func startSteps() {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    let type = HKQuantityType(.stepCount)
    health.requestAuthorization(toShare: [], read: [type]) { [weak self] _, _ in
      Task { @MainActor in
        self?.readSteps()
        self?.observeSteps()
      }
    }
  }

  private func observeSteps() {
    guard observer == nil else { return }
    let q = HKObserverQuery(sampleType: HKQuantityType(.stepCount), predicate: nil) { [weak self] _, done, _ in
      Task { @MainActor in self?.readSteps() }
      done()
    }
    observer = q
    health.execute(q)
  }

  func readSteps() {
    let start = Calendar.current.startOfDay(for: Date())
    let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
    let q = HKStatisticsQuery(quantityType: HKQuantityType(.stepCount), quantitySamplePredicate: predicate, options: .cumulativeSum) { [weak self] _, stats, _ in
      let n = Int(stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
      Task { @MainActor in self?.setSteps(n) }
    }
    health.execute(q)
  }

  private func setSteps(_ n: Int) {
    let before = steps
    liveSteps = n
    Shared.liveSteps = n
    checkGoal(before: before)
    reloadFaces()
  }

  /// A tap on the wrist and a small celebration the first time today's goal is reached.
  private func checkGoal(before: Int) {
    let key = "celebrated-\(Shared.todayKey())"
    guard before < goal, steps >= goal, !Shared.defaults.bool(forKey: key), snap != nil else { return }
    Shared.defaults.set(true, forKey: key)
    WKInterfaceDevice.current().play(.success)
    celebrate = true
  }

  private func reloadFaces(force: Bool = false) {
    // Watch faces have a small refresh budget: at most every 5 minutes unless something important changed.
    guard force || Date().timeIntervalSince(lastReload) > 300 else { return }
    lastReload = Date()
    WidgetCenter.shared.reloadAllTimelines()
  }

  // MARK: - Snapshot from the iPhone

  fileprivate func receive(_ context: [String: Any]) {
    guard let json = context["state"] as? String, let data = json.data(using: .utf8),
          let s = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
    let before = steps
    let changedStatus = s.status != snap?.status || s.trip?.endAt != snap?.trip?.endAt
    snap = s
    Shared.saveSnapshot(s)
    checkGoal(before: before)
    reloadFaces(force: changedStatus)
  }

  // MARK: - Buttons

  enum Action: String { case feed, water }

  func send(_ action: Action) {
    WKInterfaceDevice.current().play(.click)
    // Show the change right away; the phone applies it for real.
    if var s = snap {
      switch action {
      case .feed: s.needs.food = min(100, s.needs.food + 45)
      case .water: s.needs.water = min(100, s.needs.water + 15)
      }
      s.refreshStatus()
      snap = s
      Shared.saveSnapshot(s)
      reloadFaces(force: true)
    }
    let payload: [String: Any] = ["action": "{\"id\":\"\(UUID().uuidString)\",\"kind\":\"\(action.rawValue)\"}"]
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { _ in
        session.transferUserInfo(payload)
      }
    } else {
      // Waits and is delivered the next time the iPhone app runs.
      session.transferUserInfo(payload)
    }
  }
}

extension WatchStore: WCSessionDelegate {
  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    let context = session.receivedApplicationContext
    Task { @MainActor in self.receive(context) }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in self.receive(applicationContext) }
  }
}
