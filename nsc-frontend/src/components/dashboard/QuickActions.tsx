import { Button } from '@/components/ui/button'
import Section from '@/components/common/Section'

export default function QuickActions() {
  return (
    <Section title="Quick Actions">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button className="justify-center">Resume Last Session</Button>
        <Button variant="outline" className="justify-center">Play Asset to Chair</Button>
        <Button variant="outline" className="justify-center">Start Group Sync</Button>
      </div>
    </Section>
  )
}
