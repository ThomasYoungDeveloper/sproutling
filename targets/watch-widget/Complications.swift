import SwiftUI
import WidgetKit

/// Watch face spots: sprite in a steps ring, "steps to goal" with the status, and the adventure timer.
struct Entry: TimelineEntry {
  let date: Date
  let snap: Snapshot?
  let steps: Int

  var goal: Int { max(1, snap?.goal ?? 8000) }
  var left: Int { max(0, goal - steps) }
  var pct: Double { min(1, Double(steps) / Double(goal)) }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: Date(), snap: nil, steps: 6760)
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(current())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = current()
    var entries = [entry]
    // When an adventure ends, switch from the timer back to steps.
    if let end = entry.snap?.tripEnd {
      entries.append(Entry(date: end, snap: entry.snap, steps: entry.steps))
    }
    completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(15 * 60))))
  }

  private func current() -> Entry {
    let snap = Shared.loadSnapshot()
    return Entry(date: Date(), snap: snap, steps: Shared.steps(snap))
  }
}

private let mint = Color(red: 0.36, green: 0.89, blue: 0.66)

struct Sprite: View {
  let species: String?
  var body: some View {
    if let species {
      Image("pet_\(species)").resizable().scaledToFit()
    } else {
      Image(systemName: "leaf.fill").resizable().scaledToFit().foregroundStyle(mint)
    }
  }
}

struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: Entry

  var body: some View {
    switch family {
    case .accessoryCircular:
      Gauge(value: entry.pct) {
        EmptyView()
      } currentValueLabel: {
        Sprite(species: entry.snap?.pet?.species).padding(2)
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .tint(mint)
      .widgetAccentable()

    case .accessoryRectangular:
      HStack(spacing: 6) {
        Sprite(species: entry.snap?.trip?.species ?? entry.snap?.pet?.species).frame(width: 38, height: 38)
        VStack(alignment: .leading, spacing: 1) {
          if let trip = entry.snap?.trip, let end = entry.snap?.tripEnd, entry.date < end {
            Text(trip.place).font(.headline).lineLimit(1)
            Text(timerInterval: entry.date...end, countsDown: true).font(.caption).monospacedDigit()
          } else {
            Text(entry.left > 0 ? "\(entry.left.grouped) to goal" : "Goal reached!")
              .font(.headline).lineLimit(1).minimumScaleFactor(0.7)
              .widgetAccentable()
            if let snap = entry.snap, let pet = snap.pet {
              Text(snap.status.key == "good" ? "\(pet.name) is happy" : "\(pet.name) is \(snap.status.text.lowercased())")
                .font(.caption).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(.secondary)
            }
          }
        }
        Spacer(minLength: 0)
      }

    case .accessoryInline:
      Text(entry.left > 0 ? "\(entry.left.grouped) steps to goal" : "Step goal reached")

    case .accessoryCorner:
      Sprite(species: entry.snap?.pet?.species)
        .padding(4)
        .widgetLabel {
          Gauge(value: entry.pct) { Text("Steps") }
            .tint(mint)
        }

    default:
      Text("\(entry.steps.grouped) steps")
    }
  }
}

@main
struct SproutlingComplications: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SproutlingComplications", provider: Provider()) { entry in
      ComplicationView(entry: entry)
        .containerBackground(.clear, for: .widget)
    }
    .configurationDisplayName("Sproutling")
    .description("Your sprite, today's steps and adventures.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
  }
}
