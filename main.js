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
            'Accept': 'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9,image/*;q=0.8,*/*;q=0.7'
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
        }
    };

    console.log('Making request to:', requestConfig.url);
    console.log('Request payload:', requestConfig.json);

    // Make the HTTP request
    const response = await gotScraping(requestConfig);
    
    console.log('Response status:', response.statusCode);
    console.log('Response headers:', response.headers);

    // Parse response
    let responseData;
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