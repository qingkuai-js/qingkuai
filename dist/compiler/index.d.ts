declare function compile(source: string, componentName: string): {
    code: string;
    mappings: string;
    isTS: boolean;
};

export { compile };
