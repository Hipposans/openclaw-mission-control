import { OfficeScene } from '@/components/office/office-scene';

export default function OfficePage() {
  return (
    <div className='flex flex-col gap-4 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Office</h1>
        <p className='text-muted-foreground text-sm'>Live view of the team</p>
      </div>
      <OfficeScene />
    </div>
  );
}
