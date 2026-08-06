import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'admin/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Globals del browser
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        // Globals del proyecto (definidos en config.js)
        SUPABASE_URL: 'readonly',
        SUPABASE_ANON: 'readonly',
        WHATSAPP_NUM: 'readonly',
        PRECIO_ENVIO: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // config.js define globals del proyecto — no es un módulo normal
    files: ['js/config.js'],
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Ignorar carpetas
    ignores: ['node_modules/**', 'documentacion/**'],
  },
];
