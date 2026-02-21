// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://teamorchestrator.com',
  integrations: [
    starlight({
      title: 'Team Orchestrator',
      description: 'Mission Control for your digital workforce.',
      logo: {
        label: 'Team Orchestrator',
        src: './src/assets/logo.svg',
      },
      social: [
        { label: 'GitHub', href: 'https://github.com/teamorchestrator', icon: 'github' },
      ],
      customCss: ['./src/styles/global.css', './src/styles/starlight.css'],
      sidebar: [
        {
          label: 'Getting Started',
          link: '/docs/getting-started/',
        },
        {
          label: 'Foundation',
          autogenerate: { directory: 'docs/foundation' },
        },
        {
          label: 'Operations',
          autogenerate: { directory: 'docs/operations' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'docs/reference' },
        },
      ],
      expressiveCode: true,
      editLink: {
        baseUrl: 'https://github.com/teamorchestrator/com/edit/main/',
      },
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});