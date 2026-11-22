import Foundation

// Keep this file identical in targets/watch and targets/watch-widget.

/// What the iPhone game sends to the watch (see src/game/watch.ts).
struct Snapshot: Codable, Equatable {
  struct Pet: Codable, Equatable {
    var name: String
    var species: String
    var level: Int
  }
  struct Status: Codable, Equatable {
    var key: String
    var text: String
  }
  struct Needs: Codable, Equatable {
    var food: Double
    var fun: Double
    var water: Double
    var energy: Double
  }
  struct Goal: Codable, Equatable {
    var label: String
    var stepsLeft: Int
  }
  struct Trip: Codable, Equatable {
    var name: String
    var species: String
    var place: String
    var endAt: Double
    var note: String
  }

  var v: Int
  var day: String
  var pet: Pet?
  var status: Status
  var needs: Needs
  var steps: Int
  var goal: Int
  var egg: Goal?
  var guild: Goal?
  var trip: Trip?

  var tripEnd: Date? {
    guard let trip else { return nil }
    let end = Date(timeIntervalSince1970: trip.endAt / 1000)
    return end > Date() ? end : nil
  }

  /// The status the pet shows, worked out again after a button on the watch changes its needs.
  mutating func refreshStatus() {
    let low: [(String, String, Double)] = [
      ("hungry", "Hungry", needs.food),
      ("thirsty", "Thirsty", needs.water),
      ("bored", "Wants to play", needs.fun),
      ("tired", "Sleepy", needs.energy),
    ]
    if let worst = low.filter({ $0.2 < 45 }).min(by: { $0.2 < $1.2 }) {
      status = Status(key: worst.0, text: worst.1)
    } else {
      status = Status(key: "good", text: "All good")
    }
  }
}

/// Storage shared by the watch app and its watch face complications.
enum Shared {
  static let group = "group.com.sproutlingapp.sproutling.watch"
  static var defaults: UserDefaults { UserDefaults(suiteName: group) ?? .standard }

  static func loadSnapshot() -> Snapshot? {
    guard let data = defaults.data(forKey: "snapshot") else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
  }

  static func saveSnapshot(_ s: Snapshot) {
    if let data = try? JSONEncoder().encode(s) { defaults.set(data, forKey: "snapshot") }
  }

  /// Steps read on the watch today (resets at midnight).
  static var liveSteps: Int {
    get { defaults.string(forKey: "liveStepsDay") == todayKey() ? defaults.integer(forKey: "liveSteps") : 0 }
    set {
      defaults.set(newValue, forKey: "liveSteps")
      defaults.set(todayKey(), forKey: "liveStepsDay")
    }
  }

  static func todayKey(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }

  /// Today's steps: the higher of the watch's own count and the game's.
  static func steps(_ snap: Snapshot?) -> Int {
    let phone = (snap?.day == todayKey()) ? (snap?.steps ?? 0) : 0
    return max(liveSteps, phone)
  }
}

extension Int {
  var grouped: String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    return f.string(from: NSNumber(value: self)) ?? String(self)
  }
}
