interface JournalCardProps {
  selectedServiceId: string;
  journal: string;
}

export function JournalCard({ selectedServiceId, journal }: JournalCardProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>
          <i className="fa-solid fa-scroll" />
          Journal
        </h2>
      </header>
      <p className="dim">service_id: {selectedServiceId || "(none)"}</p>
      <pre>{journal || "Select service and click journal."}</pre>
    </section>
  );
}

