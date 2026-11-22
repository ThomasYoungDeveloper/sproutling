import SwiftUI

@main
struct SproutlingWatchApp: App {
  @StateObject private var store = WatchStore()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
        .onAppear { store.startSteps() }
    }
  }
}

private let mint = Color(red: 0.36, green: 0.89, blue: 0.66)
private let food = Color(red: 1.0, green: 0.70, blue: 0.35)
private let fun = Color(red: 0.71, green: 0.55, blue: 1.0)
private let water = Color(red: 0.35, green: 0.72, blue: 1.0)
private let card = Color(white: 0.12)

enum Page: Hashable { case status, needs, goals, trip }

struct RootView: View {
  @EnvironmentObject var store: WatchStore
  @Environment(\.scenePhase) private var phase
  @State private var page: Page = .status

  var body: some View {
    Group {
      if store.snap == nil {
        ConnectView()
      } else {
        TabView(selection: $page) {
          StatusView(page: $page).tag(Page.status)
          NeedsView().tag(Page.needs)
          GoalsView().tag(Page.goals)
          if store.snap?.tripEnd != nil {
            TripView().tag(Page.trip)
          }
        }
        .tabViewStyle(.verticalPage)
      }
    }
    .sheet(isPresented: $store.celebrate) { GoalReachedView().environmentObject(store) }
    .onChange(of: phase) { _, p in
      if p == .active { store.readSteps() }
    }
  }
}

struct SpriteImage: View {
  let species: String
  var body: some View {
    Image("pet_\(species)")
      .resizable()
      .scaledToFit()
      .accessibilityHidden(true)
  }
}

/// 1. The screen it opens to: sprite in a steps ring, today's steps, steps to the goal, and one status.
struct StatusView: View {
  @EnvironmentObject var store: WatchStore
  @Binding var page: Page

  var body: some View {
    let snap = store.snap
    let left = max(0, store.goal - store.steps)
    let pct = min(1, Double(store.steps) / Double(store.goal))
    ScrollView {
      VStack(spacing: 4) {
        if let pet = snap?.pet {
          Text("Lv \(pet.level) \(pet.name)")
            .font(.footnote.weight(.bold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
          ZStack {
            Circle().stroke(Color(white: 0.18), lineWidth: 9)
            Circle()
              .trim(from: 0, to: pct)
              .stroke(mint, style: StrokeStyle(lineWidth: 9, lineCap: .round))
              .rotationEffect(.degrees(-90))
            SpriteImage(species: pet.species).padding(20)
          }
          .frame(width: 112, height: 112)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("\(pet.name), \(Int(pct * 100)) percent of today's step goal")
        }
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(store.steps.grouped).font(.title2.weight(.heavy)).monospacedDigit()
          Text("steps").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
        }
        Text(left > 0 ? "\(left.grouped) to your goal" : "Goal reached!")
          .font(.footnote.weight(.bold))
          .foregroundStyle(mint)
        if let status = snap?.status {
          Button {
            switch status.key {
            case "hungry": store.send(.feed)
            case "thirsty": store.send(.water)
            default: page = .needs
            }
          } label: {
            Text(statusLabel(status))
              .font(.caption.weight(.heavy))
              .lineLimit(1)
              .minimumScaleFactor(0.7)
          }
          .buttonStyle(.borderedProminent)
          .tint(status.key == "good" ? Color(white: 0.2) : Color(red: 0.36, green: 0.23, blue: 0.11))
          .foregroundStyle(status.key == "good" ? mint : food)
          .padding(.top, 2)
        }
      }
      .padding(.horizontal, 4)
    }
  }

  private func statusLabel(_ s: Snapshot.Status) -> String {
    switch s.key {
    case "hungry": return "Hungry · tap to feed"
    case "thirsty": return "Thirsty · tap for water"
    case "bored", "tired": return "\(s.text) · see needs"
    default: return s.text
    }
  }
}

/// 2. What the sprite wants, with Feed and +1 water right on the wrist.
struct NeedsView: View {
  @EnvironmentObject var store: WatchStore

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        if let snap = store.snap, let pet = snap.pet {
          HStack(spacing: 6) {
            SpriteImage(species: pet.species).frame(width: 36, height: 36)
            Text(snap.status.key == "good" ? "\(pet.name) is happy" : "\(pet.name) is \(snap.status.text.lowercased())")
              .font(.headline)
              .lineLimit(2)
              .minimumScaleFactor(0.7)
          }
          NeedBar(label: "Food", value: snap.needs.food, color: food)
          NeedBar(label: "Fun", value: snap.needs.fun, color: fun)
          NeedBar(label: "Water", value: snap.needs.water, color: water)
          NeedBar(label: "Energy", value: snap.needs.energy, color: mint)
          HStack(spacing: 6) {
            Button("Feed") { store.send(.feed) }
              .buttonStyle(.borderedProminent).tint(food).foregroundStyle(.black)
            Button("+1 water") { store.send(.water) }
              .buttonStyle(.borderedProminent).tint(water).foregroundStyle(.black)
          }
          .font(.footnote.weight(.heavy))
          Text("Play and treats are in the iPhone app.")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      .padding(.horizontal, 4)
    }
  }
}

struct NeedBar: View {
  let label: String
  let value: Double
  let color: Color

  var body: some View {
    HStack(spacing: 6) {
      Text(label).font(.caption2.weight(.bold)).foregroundStyle(.secondary).frame(width: 44, alignment: .leading)
      GeometryReader { g in
        ZStack(alignment: .leading) {
          Capsule().fill(Color(white: 0.18))
          Capsule().fill(color).frame(width: max(6, g.size.width * min(1, value / 100)))
        }
      }
      .frame(height: 7)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(label) \(Int(value)) percent")
  }
}

/// 3. Next goals: daily steps, the egg closest to hatching, and the guild chest.
struct GoalsView: View {
  @EnvironmentObject var store: WatchStore

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        Text("Next up").font(.headline)
        let left = max(0, store.goal - store.steps)
        GoalCard(title: "Daily goal", value: left > 0 ? "\(left.grouped) steps to go" : "Done for today", color: mint)
        if let egg = store.snap?.egg {
          GoalCard(title: egg.label, value: egg.stepsLeft > 0 ? "\(egg.stepsLeft.grouped) steps to hatch" : "Ready to hatch", color: food)
        }
        if let guild = store.snap?.guild {
          GoalCard(title: guild.label, value: "\(guild.stepsLeft.grouped) steps left", color: Color(red: 0.79, green: 0.82, blue: 1.0))
        }
      }
      .padding(.horizontal, 4)
    }
  }
}

struct GoalCard: View {
  let title: String
  let value: String
  let color: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(title).font(.caption2.weight(.bold)).foregroundStyle(.secondary)
      Text(value).font(.footnote.weight(.heavy)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(8)
    .background(card, in: RoundedRectangle(cornerRadius: 12))
  }
}

/// 4. Adventure countdown, only while a sprite is out.
struct TripView: View {
  @EnvironmentObject var store: WatchStore

  var body: some View {
    if let trip = store.snap?.trip, let end = store.snap?.tripEnd {
      VStack(spacing: 4) {
        Text("ON AN ADVENTURE").font(.caption2.weight(.heavy)).foregroundStyle(.secondary)
        SpriteImage(species: trip.species).frame(width: 60, height: 60)
        Text("\(trip.name) · \(trip.place)").font(.footnote.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
        Text(timerInterval: Date()...end, countsDown: true)
          .font(.title2.weight(.heavy))
          .monospacedDigit()
          .foregroundStyle(water)
        Text(trip.note).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
      }
    } else {
      Text("Back home").font(.headline)
    }
  }
}

/// 5. Shown once when today's goal is reached.
struct GoalReachedView: View {
  @EnvironmentObject var store: WatchStore

  var body: some View {
    VStack(spacing: 6) {
      if let pet = store.snap?.pet {
        SpriteImage(species: pet.species).frame(width: 84, height: 84)
      }
      Text("Goal reached!").font(.title3.weight(.heavy))
      Text("\(store.goal.grouped) steps").font(.footnote.weight(.bold)).foregroundStyle(mint)
      Text("Open Sproutling for your reward.").font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
    }
  }
}

struct ConnectView: View {
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "iphone").font(.title2).foregroundStyle(mint)
      Text("Open Sproutling on your iPhone to connect.")
        .font(.footnote.weight(.semibold))
        .multilineTextAlignment(.center)
    }
    .padding()
  }
}
