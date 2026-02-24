export function MapLegend() {
  return (
    <div className="map-legend">
      <div className="ml-item">
        <span className="ml-dot ml-online" />
        <span>Çevrimiçi</span>
      </div>
      <div className="ml-item">
        <span className="ml-dot ml-offline" />
        <span>Çevrimdışı</span>
      </div>
      <div className="ml-item">
        <span className="ml-line" />
        <span>Bağlantı</span>
      </div>
      <div className="ml-item">
        <span className="ml-server" />
        <span>Sunucu</span>
      </div>
    </div>
  );
}
