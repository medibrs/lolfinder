export async function analyzeTextSafety(text: string) {
    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
    const key = process.env.CONTENT_SAFETY_KEY;

    if (!endpoint || !key) {
        throw new Error('Azure Content Safety credentials missing');
    }

    let url = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    if (!url.startsWith('http')) url = `https://${url}`;

    const response = await fetch(`${url}/contentsafety/text:analyze?api-version=2023-10-01`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        throw new Error(`Text safety API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    return result;
}

export async function analyzeImageSafety(base64Image: string) {
    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
    const key = process.env.CONTENT_SAFETY_KEY;

    if (!endpoint || !key) {
        throw new Error('Azure Content Safety credentials missing');
    }

    let url = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    if (!url.startsWith('http')) url = `https://${url}`;

    const response = await fetch(`${url}/contentsafety/image:analyze?api-version=2023-10-01`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: { content: base64Image }
        })
    });

    if (!response.ok) {
        throw new Error(`Image safety API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    return result;
}

export function getFlaggedCategories(result: any): string[] {
    let flaggedCategories: string[] = [];

    if (result.categoriesAnalysis) {
        for (const analysis of result.categoriesAnalysis) {
            if (analysis.severity > 0) {
                flaggedCategories.push(analysis.category);
            }
        }
    } else {
        const legacyCategories = ['hateResult', 'selfHarmResult', 'sexualResult', 'violenceResult'];
        for (const cat of legacyCategories) {
            if (result[cat] && result[cat].severity > 0) {
                flaggedCategories.push(result[cat].category || cat.replace('Result', ''));
            }
        }
    }

    return flaggedCategories;
}

export async function analyzeImageVision(buffer: Buffer, features: string[] = ['Tags']) {
    const endpoint = process.env.VISION_ENDPOINT;
    const key = process.env.VISION_KEY;

    if (!endpoint || !key) {
        throw new Error('Azure Vision credentials missing');
    }

    let url = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    if (!url.startsWith('http')) url = `https://${url}`;

    const featureString = features.join(',');

    const response = await fetch(`${url}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=${featureString}`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/octet-stream'
        },
        body: buffer as any
    });

    if (!response.ok) {
        throw new Error(`Vision API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    return result;
}

export function validateImageTags(visionResult: any, requiredTags: string[], minConfidence: number = 0.5): { isValid: boolean, foundTags: string[] } {
    if (!visionResult || !visionResult.tagsResult || !visionResult.tagsResult.values) {
        return { isValid: false, foundTags: [] };
    }

    const detectedTags = visionResult.tagsResult.values
        .filter((tag: any) => tag.confidence >= minConfidence)
        .map((tag: any) => tag.name.toLowerCase());

    const hasRequiredTag = requiredTags.length === 0 || requiredTags.some(requiredTag =>
        detectedTags.includes(requiredTag.toLowerCase())
    );

    return {
        isValid: hasRequiredTag,
        foundTags: detectedTags
    };
}
