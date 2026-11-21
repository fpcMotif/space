import type { SpaceNode } from './types';

/** Used whenever ~/Library/Application Support/Space/space.json is missing. */
export const demoTree: SpaceNode = {
  arrange: 'row',
  children: [
    {
      name: 'Design',
      weight: 1,
      arrange: 'column',
      children: [
        {
          weight: 1.4,
          window: { bundleID: 'com.apple.Safari', app: 'Safari', title: 'Figma — Space' },
        },
        {
          name: 'Refs',
          arrange: 'row',
          children: [
            { window: { bundleID: 'com.apple.finder', app: 'Finder', title: 'Design Assets' } },
            { window: { bundleID: 'com.apple.Notes', app: 'Notes', title: 'Moodboard' } },
          ],
        },
      ],
    },
    {
      name: 'Build',
      weight: 1,
      arrange: 'stack',
      active: 1,
      children: [
        { window: { bundleID: 'com.apple.Terminal', app: 'Terminal', title: 'space — bun run macos' } },
        { window: { bundleID: 'com.apple.Safari', app: 'Safari', title: 'localhost:8081 — Metro' } },
        { window: { bundleID: 'com.apple.Notes', app: 'Notes', title: 'Build log' } },
      ],
    },
    {
      name: 'Notes',
      weight: 1,
      arrange: 'column',
      children: [
        { window: { bundleID: 'com.apple.Notes', app: 'Notes', title: 'Ideas' } },
        { window: { bundleID: 'com.apple.Terminal', app: 'Terminal', title: 'scratch' } },
      ],
    },
  ],
};
