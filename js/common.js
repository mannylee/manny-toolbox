/*
	CONSTANTS object
*/
const CONSTANTS = {
	PAGES: {
		listmagic: "listmagic",
		urldecoder: "urldecoder"
	}
};

/*
	SPA object
	Single page application uses
*/
const SPA = {
	config: {
		defaultPage: CONSTANTS.PAGES.listmagic
		// defaultPage: CONSTANTS.PAGES.urldecoder
	},
	variables: {
		currentPage: null,
		previousPage: null,
		hooksOnPageUnload: [],
		hooksOnPageLoad: [],
		currentPageObject: null
	},
	initialise: ()=>{
		CommonHelpers.logger.info("initialise", "SPA");
		SPA.loadPage(new URLSearchParams(window.location.search).get('page'));
	},
	loadPage: (page)=>{
		// check if requested is a recognised page, otherwise set a default value
		if(!CONSTANTS.PAGES.hasOwnProperty(page)){
			page = SPA.config.defaultPage;
		}

		// Execute any page unload hooks
		// TODO: fill

		CommonHelpers.logger.info("requesting for page: " + page, "SPA");		
		

		// Load the html file first
		$("body").load("content/" + page + ".html", ()=>{
			// Load the page JS dynamically, after HTML is done
			$.getScript("js/" + page + ".js").done(SPA.onPageLoadHook);
		});

	},
	onPageLoadHook: ()=>{
		// Execute any page load hooks
		
		// Update title
		SPA.variables.currentPageObject.pageElements.h2Title.text(SPA.variables.currentPageObject.friendlyName);
		document.title = SPA.variables.currentPageObject.friendlyName;
		
		// TODO: fill
	}
};



/*
	Helper functions
*/
const CommonHelpers = {
	logger: {
		info: (message, source)=>{
			console.info((source ? source + ": " : "") + message);
		},
		log: (message, source)=>{
			console.log((source ? source + ": " : "") + message);
		}
	}
}
