import { Download } from 'lucide-react';
import { SectionHeader, Button } from '../components/ui/primitives.jsx';
import { UsageHistory } from '../components/UsageHistory.jsx';
import { Heatmap } from '../components/Heatmap.jsx';

// History section: the 1h/24h usage chart (with its own range toggle) plus the
// day-of-week × hour-of-day latency heatmap, and a CSV export of the raw range.
export function History() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        right={
          <div className="flex gap-1.5">
            <a href="/api/history/export.csv?range=1h" download>
              <Button size="sm" variant="outline">
                <Download className="h-3 w-3" /> 1h CSV
              </Button>
            </a>
            <a href="/api/history/export.csv?range=24h" download>
              <Button size="sm" variant="outline">
                <Download className="h-3 w-3" /> 24h CSV
              </Button>
            </a>
          </div>
        }
      >
        History
      </SectionHeader>

      <UsageHistory />
      <Heatmap />
    </div>
  );
}
