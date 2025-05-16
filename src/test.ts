function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
    return Object.keys(obj).reduce((acc, key) => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(acc, flattenObject(obj[key], newKey));
        } else {
            acc[newKey] = obj[key];
        }
        return acc;
    }, {} as Record<string, any>);
}

let html = `<b> Hello world! {{name}} {{user.name}} {{course.title}} </b>`;

let parameters: Record<string, any> = {
    name: 'lol',
    user: {
        name: 'hi my name is zaza'
    },
    course: {
        title: "course math for you"
    }
};

let flattenedParams = flattenObject(parameters);

for (const key in flattenedParams) {
    const value = flattenedParams[key];
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
}

console.log(html);
