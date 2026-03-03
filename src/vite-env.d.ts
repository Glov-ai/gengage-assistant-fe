interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
