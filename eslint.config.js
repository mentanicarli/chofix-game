import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/legacy', 'src/audio', 'data', 'vite.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error'
    }
  },
  {
    // Мир: частицы и канвас-хелперы — плотная математика, утверждения о ненулевых значениях здесь сознательные.
    files: ['src/render/world/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' }
  },
  {
    // Правило архитектуры: чистая логика ничего не знает про DOM и рендер.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage', 'requestAnimationFrame', 'performance'],
      'no-restricted-imports': ['error', { patterns: ['../render/*', '../ui/*', '../legacy/*', 'pixi.js'] }]
    }
  }
);
