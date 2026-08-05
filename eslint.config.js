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
    // Ignorar carpetas
    ignores: ['node_modules/**', 'documentacion/**'],
  },
];
