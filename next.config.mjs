const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default { reactStrictMode: true, output: 'export', trailingSlash: true, basePath: base, images: { unoptimized: true } };
