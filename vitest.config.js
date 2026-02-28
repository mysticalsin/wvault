import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.{js,ts}'],
        coverage: {
            provider: 'v8',
            include: ['src/main/**/*.js'],
        },
        testTimeout: 30000, // Crypto operations can be slow
    },
});
