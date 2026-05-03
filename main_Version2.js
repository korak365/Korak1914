// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Crawlee - web scraping and browser automation library (Read more at https://crawlee.dev)
import { CheerioCrawler, Dataset } from 'crawlee';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init()
await Actor.init();

// Structure of input is defined in input_schema.json
const { startUrls = ['https://www.amazon.com/s?k=electronics'], maxRequestsPerCrawl = 100, searchTerm = 'electronics' } = (await Actor.getInput()) ?? {};

// Proxy configuration to rotate IP addresses and prevent blocking (https://docs.apify.com/platform/proxy)
const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    async requestHandler({ enqueueLinks, request, $, log }) {
        log.info('Processing page:', { url: request.loadedUrl });
        await enqueueLinks();

        // Extract product information including hidden coupons
        $('div[data-component-type="s-search-result"]').each((index, element) => {
            const $product = $(element);
            
            const productTitle = $product.h2.a?.text?.trim() || 'N/A';
            const productUrl = $product.h2.a?.attr('href') ? `https://www.amazon.com${$product.h2.a.attr('href')}` : 'N/A';
            const regularPrice = $product.find('.a-price-whole')?.text?.trim() || 'N/A';
            const couponDiscount = $product.find('[aria-label*="coupon"], [aria-label*="clip"]')?.text?.trim() || 'No coupon';
            const finalPrice = $product.find('.a-price-now')?.text?.trim() || regularPrice;

            log.info(`Found product: ${productTitle}`, { 
                url: productUrl,
                coupon: couponDiscount
            });

            // Save product data to Dataset - a table-like storage.
            Dataset.pushData({ 
                productTitle, 
                productUrl, 
                regularPrice, 
                couponDiscount, 
                finalPrice 
            });
        });
    },
});

await crawler.run(startUrls);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit()
await Actor.exit();