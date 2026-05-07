'use client';

export default function LivePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Live Monitoring</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black aspect-video rounded-lg flex items-center justify-center text-white relative">
          <span className="absolute top-2 left-2 bg-red-600 px-2 py-1 text-xs rounded">LIVE</span>
          <p>Main Gate Camera</p>
        </div>
        <div className="bg-black aspect-video rounded-lg flex items-center justify-center text-white relative">
          <span className="absolute top-2 left-2 bg-red-600 px-2 py-1 text-xs rounded">LIVE</span>
          <p>Backyard Camera</p>
        </div>
      </div>
    </div>
  );
}
