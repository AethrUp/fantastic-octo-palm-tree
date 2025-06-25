// main.js
import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';

await Actor.init();

try {
    // Get input from Actor input schema
    const input = await Actor.getInput();
    console.log('Input:', input);

    // Extract parameters with defaults
    const {
        courtItemID = input.courtItemID,
        queryText = input.queryText || '',
        pageIndex = input.pageIndex || '1',
        pageSize = input.pageSize || '20',
        advanced = input.advanced || 'true',
        activeFlag = input.activeFlag || 'All',
        fileStart = input.fileStart,
        fileEnd = input.fileEnd
    } = input;

    // Validate required parameters
    if (!courtItemID) {
        throw new Error('courtItemID is required');
    }

    // Prepare the request configuration
    const requestConfig = {
        url: 'https://public.courts.in.gov/mycase/Search/SearchCases',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://public.courts.in.gov',
            'Referer': 'https://public.courts.in.gov/mycase/',
            'Accept': 'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9,image/*;q=0.8,*/*;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        json: {
            CourtItemID: courtItemID,
            QueryText: queryText,
            PageIndex: pageIndex,
            PageSize: pageSize,
            Advanced: advanced,
            ActiveFlag: activeFlag,
            FileStart: fileStart || '',
            FileEnd: fileEnd || ''
        },
        timeout: {
            request: 30000 // 30 second timeout
        },
        retry: {
            limit: 2
        },
        followRedirect: true,
        maxRedirects: 5
    };

    console.log('Making request to:', requestConfig.url);
    console.log('Request payload:', requestConfig.json);

    let response;
    let responseData;

    // First, let's test basic connectivity
    console.log('Testing DNS resolution...');
    try {
        const testResponse = await fetch('https://httpbin.org/get');
        console.log('Basic internet connectivity: OK');
    } catch (testError) {
        console.log('Basic internet connectivity failed:', testError.message);
    }

    // Try different approaches
    const attempts = [
        // Attempt 1: got-scraping with proxy
        async () => {
            console.log('Attempt 1: got-scraping with Apify proxy...');
            return await gotScraping({
                ...requestConfig,
                proxyUrl: await Actor.createProxyConfiguration()?.newUrl()
            });
        },
        
        // Attempt 2: got-scraping without proxy
        async () => {
            console.log('Attempt 2: got-scraping without proxy...');
            return await gotScraping(requestConfig);
        },
        
        // Attempt 3: native fetch
        async () => {
            console.log('Attempt 3: native fetch...');
            const fetchResponse = await fetch(requestConfig.url, {
                method: 'POST',
                headers: requestConfig.headers,
                body: JSON.stringify(requestConfig.json)
            });
            
            return {
                statusCode: fetchResponse.status,
                headers: Object.fromEntries(fetchResponse.headers.entries()),
                body: await fetchResponse.text()
            };
        },
        
        // Attempt 4: Try HTTP instead of HTTPS (last resort)
        async () => {
            console.log('Attempt 4: trying HTTP instead of HTTPS...');
            const httpUrl = requestConfig.url.replace('https://', 'http://');
            const fetchResponse = await fetch(httpUrl, {
                method: 'POST',
                headers: requestConfig.headers,
                body: JSON.stringify(requestConfig.json)
            });
            
            return {
                statusCode: fetchResponse.status,
                headers: Object.fromEntries(fetchResponse.headers.entries()),
                body: await fetchResponse.text()
            };
        }
    ];

    let lastError;
    for (let i = 0; i < attempts.length; i++) {
        try {
            response = await attempts[i]();
            console.log(`Success with attempt ${i + 1}`);
            break;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed:`, error.message);
            lastError = error;
            
            // If this is the last attempt, throw the error
            if (i === attempts.length - 1) {
                throw new Error(`All network attempts failed. Last error: ${error.message}`);
            }
        }
    }
    
    console.log('Response status:', response.statusCode);
    console.log('Response headers:', response.headers);

    // Parse response
    try {
        responseData = JSON.parse(response.body);
    } catch (parseError) {
        console.log('Failed to parse JSON, storing raw response');
        responseData = {
            raw: response.body,
            statusCode: response.statusCode,
            headers: response.headers
        };
    }

    // Save the result to dataset
    await Actor.pushData({
        timestamp: new Date().toISOString(),
        input: input,
        response: responseData,
        statusCode: response.statusCode,
        success: response.statusCode >= 200 && response.statusCode < 300
    });

    console.log('Data saved to dataset');

} catch (error) {
    console.error('Actor failed:', error);
    
    // Save error information
    await Actor.pushData({
        timestamp: new Date().toISOString(),
        error: error.message,
        success: false
    });
    
    // Set exit code to indicate failure
    process.exit(1);
}

await Actor.exit();