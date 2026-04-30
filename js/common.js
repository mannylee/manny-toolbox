/*
	CONSTANTS object
*/
const CONSTANTS = {
	PAGES: {
		listmagic: "listmagic",
		urldecoder: "urldecoder",
		jsonunfurler: "jsonunfurler",
		awsipchecker: "awsipchecker",
		kirocliformatter: "kirocliformatter"
	}
};

/*
	Navigation metadata
	Drives the sidebar. Order here is the display order.
*/
const NAV_ITEMS = [
	{ key: CONSTANTS.PAGES.listmagic,         label: "List Magic",         icon: "bi-list-ul" },
	{ key: CONSTANTS.PAGES.urldecoder,        label: "URL Decoder",        icon: "bi-link-45deg" },
	{ key: CONSTANTS.PAGES.jsonunfurler,      label: "JSON Unfurler",      icon: "bi-braces" },
	{ key: CONSTANTS.PAGES.awsipchecker,      label: "AWS IP Checker",     icon: "bi-hdd-network" },
	{ key: CONSTANTS.PAGES.kirocliformatter,  label: "Kiro CLI Formatter", icon: "bi-terminal" }
];

/*
	CONFIG Object (global)
*/
const CONFIG = {
	JSON_FORMAT_SPACING: 3
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
		currentPageObject: null,
		loadedScripts: {} // tracks which page scripts have already been fetched
	},
	initialise: ()=>{
		CommonHelpers.logger.info("initialise", "SPA");
		SPA.renderNav();
		SPA.bindSidebarControls();
		SPA.loadPage(new URLSearchParams(window.location.search).get('page'));
	},
	renderNav: ()=>{
		const $nav = $("#sidebar_nav");
		if(!$nav.length) return;

		const html = NAV_ITEMS.map(item => `
			<li class="nav-item">
				<a class="nav-link" href="?page=${item.key}" data-page="${item.key}">
					<i class="bi ${item.icon}" aria-hidden="true"></i>
					<span>${item.label}</span>
				</a>
			</li>
		`).join("");
		$nav.html(html);

		// Intercept clicks so we stay in the SPA
		$nav.on("click", "a.nav-link", function(e){
			e.preventDefault();
			const page = $(this).data("page");
			SPA.loadPage(page);
			SPA.closeSidebar();
			// Update the URL without reloading
			const url = new URL(window.location.href);
			url.searchParams.set("page", page);
			window.history.pushState({ page }, "", url);
		});

		// Handle browser back/forward
		window.addEventListener("popstate", (e)=>{
			const page = (e.state && e.state.page) || new URLSearchParams(window.location.search).get('page');
			SPA.loadPage(page);
		});
	},
	setActiveNav: (page)=>{
		$("#sidebar_nav .nav-link").removeClass("active");
		$(`#sidebar_nav .nav-link[data-page="${page}"]`).addClass("active");
	},
	bindSidebarControls: ()=>{
		$("#btn_sidebar_toggle").on("click", SPA.toggleSidebar);
		$("#btn_sidebar_close").on("click", SPA.closeSidebar);
		$("#sidebar_backdrop").on("click", SPA.closeSidebar);
		$(document).on("keydown", (e)=>{
			if(e.key === "Escape") SPA.closeSidebar();
		});
	},
	toggleSidebar: ()=>{
		$("body").toggleClass("sidebar-open");
	},
	closeSidebar: ()=>{
		$("body").removeClass("sidebar-open");
	},
	loadPage: (page)=>{
		// check if requested is a recognised page, otherwise set a default value
		if(!CONSTANTS.PAGES.hasOwnProperty(page)){
			page = SPA.config.defaultPage;
		}

		// Execute any page unload hooks
		// TODO: fill

		CommonHelpers.logger.info("requesting for page: " + page, "SPA");
		SPA.variables.previousPage = SPA.variables.currentPage;
		SPA.variables.currentPage = page;
		SPA.setActiveNav(page);

		// Load the html file into the content container (not body)
		$("#content").load("content/" + page + ".html", ()=>{
			// Load the page JS dynamically, after HTML is done.
			// First visit: fetch and execute the script (which defines the page object).
			// Subsequent visits: script is already loaded, just re-run the page's load() + onPageLoadHook.
			if(SPA.variables.loadedScripts[page]){
				// Script already executed previously; just invoke load() again.
				// load() is responsible for re-binding pageElements to the fresh DOM.
				const pageObject = SPA.getPageObjectByKey(page);
				if(pageObject && typeof pageObject.load === "function"){
					pageObject.load();
					SPA.onPageLoadHook();
				}
			} else {
				$.getScript("js/" + page + ".js").done(()=>{
					SPA.variables.loadedScripts[page] = true;
					SPA.onPageLoadHook();
				});
			}
		});

	},
	// Map page keys to their global page object (set by each page JS's load()).
	// We look them up via well-known global names.
	pageObjectByKey: {
		listmagic: () => typeof ListMagic !== "undefined" ? ListMagic : null,
		urldecoder: () => typeof UrlDecoder !== "undefined" ? UrlDecoder : null,
		jsonunfurler: () => typeof JsonUnfurler !== "undefined" ? JsonUnfurler : null,
		awsipchecker: () => typeof AwsIpChecker !== "undefined" ? AwsIpChecker : null,
		kirocliformatter: () => typeof KiroCliFormatter !== "undefined" ? KiroCliFormatter : null
	},
	getPageObjectByKey: (key)=>{
		const resolver = SPA.pageObjectByKey[key];
		return resolver ? resolver() : null;
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
