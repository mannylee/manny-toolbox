let UrlDecoder = {
	name: "UrlDecoder",
	friendlyName: "URL Decoder",
	pageElements: {
		h2Title: $("#h2_title"),
		textareaUrl: $("#textarea_url"),
		textareaDecodedFull: $("#textarea_decoded_full"),
		textareaDecodedSearchParams: $("#textarea_decoded_search_params"),
		textareaDecodedSearchParamsLabel: $("label[for='textarea_decoded_search_params']"),
		inputSwitchParseNestedJson: $("#input_switch_parse_nested_json"),
		inputSwitchAlphabeticise: $("#input_switch_alphabeticise")
	},
	config: {

	},
	variables: {
		url: null,
		originalBaseUrl: "",
		isUpdatingFromParams: false,
		isUpdatingFromUrl: false
	},
	load: () => {
		// Update SPA
		SPA.variables.currentPageObject = UrlDecoder;

		// Register listeners & configs
		UrlDecoder.pageElements.textareaUrl.on("keyup", UrlDecoder.processUrl);
		UrlDecoder.pageElements.textareaDecodedSearchParams.on("keyup", function () {
			UrlDecoder.validateJsonRealTime();
			UrlDecoder.processParamsToUrlSilent();
		});
		UrlDecoder.pageElements.textareaDecodedSearchParams.on("input", UrlDecoder.validateJsonRealTime);
		UrlDecoder.pageElements.textareaDecodedSearchParams.on("blur", UrlDecoder.formatAndSortParams);
		UrlDecoder.pageElements.inputSwitchParseNestedJson.on("change", UrlDecoder.processUrl);
		UrlDecoder.pageElements.inputSwitchAlphabeticise.on("change", UrlDecoder.processUrl);

		// Ready
		CommonHelpers.logger.info("loaded successfully", UrlDecoder.name);
	},
	destroy: () => {
		UrlDecoder = null;
	},

	// Page specific functions below this line
	// ---------------------------––––--------
	processUrl: () => {
		// Prevent infinite loop when updating from params
		if (UrlDecoder.variables.isUpdatingFromParams) return;

		UrlDecoder.variables.isUpdatingFromUrl = true;
		let rawUrl = UrlDecoder.pageElements.textareaUrl.val().trim();
		let searchParamsJson = {};


		try {
			// Store the base URL (everything before the query string)
			let [baseUrl] = rawUrl.split('?');
			UrlDecoder.variables.originalBaseUrl = baseUrl;

			// format to clean URL
			let cleanUrl = new URL(rawUrl);
			UrlDecoder.pageElements.textareaDecodedFull.val(decodeURI(rawUrl));


			// handle search parameters
			UrlDecoder.variables.url = UrlDecoder.parseComplexUrl(rawUrl);
			searchParamsJson = Object.fromEntries(UrlDecoder.variables.url.searchParams.entries())
			if (UrlDecoder.pageElements.inputSwitchParseNestedJson.prop("checked")) {
				searchParamsJson = Object.fromEntries(Object.entries(searchParamsJson).map(([key, value]) => {
					if (typeof value === 'string') {
						try {
							const parsed = JSON.parse(value);
							if (typeof parsed === 'object' && parsed !== null) {
								return [key, parsed];
							}
						} catch (e) {
							// If parsing fails, return original key-value pair
							return [key, value];
						}
					}
					return [key, value];
				}));
			}

			// Sort alphabetically if option is enabled
			if (UrlDecoder.pageElements.inputSwitchAlphabeticise.prop("checked")) {
				searchParamsJson = UrlDecoder.sortObjectKeys(searchParamsJson);
			}

			UrlDecoder.pageElements.textareaDecodedSearchParams.val(JSON.stringify(searchParamsJson, null, CONFIG.JSON_FORMAT_SPACING));
		} catch (e) {
			UrlDecoder.pageElements.textareaDecodedFull.val("");
			UrlDecoder.pageElements.textareaDecodedSearchParams.val("");
		}

		// Update UI
		let searchParamsTotal = Object.keys(searchParamsJson).length;
		UrlDecoder.pageElements.textareaDecodedSearchParamsLabel.html("URL Search Parameters" + (searchParamsTotal > 0 ? (" (" + searchParamsTotal + ")") : ""));

		UrlDecoder.variables.isUpdatingFromUrl = false;
	},
	processParamsToUrl: () => {
		// Prevent infinite loop when updating from URL
		if (UrlDecoder.variables.isUpdatingFromUrl) return;

		UrlDecoder.variables.isUpdatingFromParams = true;

		try {
			const paramsText = UrlDecoder.pageElements.textareaDecodedSearchParams.val().trim();

			if (!paramsText) {
				// If params are empty, just show the base URL
				UrlDecoder.pageElements.textareaUrl.val(UrlDecoder.variables.originalBaseUrl);
				UrlDecoder.pageElements.textareaDecodedFull.val(UrlDecoder.variables.originalBaseUrl);
				UrlDecoder.variables.isUpdatingFromParams = false;
				return;
			}

			// Parse the JSON parameters
			const paramsObj = JSON.parse(paramsText);

			// Convert JSON back to URL parameters, handling nested objects
			const urlParams = new URLSearchParams();

			Object.entries(paramsObj).forEach(([key, value]) => {
				let paramValue;

				// If value is an object/array, stringify it back to JSON
				if (typeof value === 'object' && value !== null) {
					paramValue = JSON.stringify(value);
				} else {
					paramValue = String(value);
				}

				urlParams.append(key, paramValue);
			});

			// Reconstruct the full URL
			const reconstructedUrl = UrlDecoder.variables.originalBaseUrl +
				(urlParams.toString() ? '?' + urlParams.toString() : '');

			// Update the raw URL field
			UrlDecoder.pageElements.textareaUrl.val(reconstructedUrl);

			// Update the decoded full URL
			UrlDecoder.pageElements.textareaDecodedFull.val(decodeURI(reconstructedUrl));

		} catch (e) {
			// If JSON is invalid, don't update anything
			console.warn("Invalid JSON in parameters field:", e);
		}

		UrlDecoder.variables.isUpdatingFromParams = false;
	},
	processParamsToUrlSilent: () => {
		// Silent version of processParamsToUrl for real-time editing (no console warnings)
		// Prevent infinite loop when updating from URL
		if (UrlDecoder.variables.isUpdatingFromUrl) return;

		UrlDecoder.variables.isUpdatingFromParams = true;

		try {
			const paramsText = UrlDecoder.pageElements.textareaDecodedSearchParams.val().trim();

			if (!paramsText) {
				// If params are empty, just show the base URL
				UrlDecoder.pageElements.textareaUrl.val(UrlDecoder.variables.originalBaseUrl);
				UrlDecoder.pageElements.textareaDecodedFull.val(UrlDecoder.variables.originalBaseUrl);
				UrlDecoder.variables.isUpdatingFromParams = false;
				return;
			}

			// Parse the JSON parameters
			const paramsObj = JSON.parse(paramsText);

			// Convert JSON back to URL parameters, handling nested objects
			const urlParams = new URLSearchParams();

			Object.entries(paramsObj).forEach(([key, value]) => {
				let paramValue;

				// If value is an object/array, stringify it back to JSON
				if (typeof value === 'object' && value !== null) {
					paramValue = JSON.stringify(value);
				} else {
					paramValue = String(value);
				}

				urlParams.append(key, paramValue);
			});

			// Reconstruct the full URL
			const reconstructedUrl = UrlDecoder.variables.originalBaseUrl +
				(urlParams.toString() ? '?' + urlParams.toString() : '');

			// Update the raw URL field
			UrlDecoder.pageElements.textareaUrl.val(reconstructedUrl);

			// Update the decoded full URL
			UrlDecoder.pageElements.textareaDecodedFull.val(decodeURI(reconstructedUrl));

		} catch (e) {
			// If JSON is invalid, don't update anything - NO CONSOLE WARNING for silent version
			// This prevents console spam during real-time typing
		}

		UrlDecoder.variables.isUpdatingFromParams = false;
	},
	formatAndSortParams: () => {
		// This function reformats and re-alphabetizes the JSON when user finishes editing
		// Use validation with warning since this is triggered on blur (user finished editing)
		const isValid = UrlDecoder.validateJsonWithWarning();

		if (!isValid) {
			return; // Don't format if JSON is invalid
		}

		const paramsText = UrlDecoder.pageElements.textareaDecodedSearchParams.val().trim();

		if (!paramsText) {
			return; // Nothing to format
		}

		try {
			// Parse the JSON (we know it's valid from validation above)
			let paramsObj = JSON.parse(paramsText);

			// Apply alphabetical sorting if enabled
			if (UrlDecoder.pageElements.inputSwitchAlphabeticise.prop("checked")) {
				paramsObj = UrlDecoder.sortObjectKeys(paramsObj);
			}

			// Reformat with proper indentation and update the textarea
			const formattedJson = JSON.stringify(paramsObj, null, CONFIG.JSON_FORMAT_SPACING);
			UrlDecoder.pageElements.textareaDecodedSearchParams.val(formattedJson);

			// Also update the URL fields to reflect any changes
			UrlDecoder.processParamsToUrl();

		} catch (e) {
			// This shouldn't happen since we validated above, but just in case
			console.warn("Unexpected error during JSON formatting:", e);
		}
	},
	parseComplexUrl: (urlString) => {
		// Split the URL into base and query string
		let [baseUrl, ...queryParts] = urlString.split('?');
		let url = new URL(baseUrl);

		// Join all query parts back together
		let fullQueryString = queryParts.join('?');

		// Split the query string by both '?' and '&'
		let params = fullQueryString.split(/[?&]|#\//);

		params.forEach(param => {
			if (param) {  // Ignore empty strings
				let [key, value] = param.split('=');
				// if (value === undefined) {
				// 	// If there's no '=', assume the whole param is a key with an empty value
				// 	key = param;
				// 	value = '';
				// }

				// only append if there is a non-empty value
				if (value !== undefined) {
					url.searchParams.append(decodeURIComponent(key), decodeURIComponent(value));
				}
			}
		});

		return url;
	},
	sortObjectKeys: (obj) => {
		// Handle null or non-object values
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}

		// Handle arrays
		if (Array.isArray(obj)) {
			// First recursively sort any nested objects/arrays within the array
			const processedArray = obj.map(item => UrlDecoder.sortObjectKeys(item));

			// Then sort the array contents if they are primitive values (strings/numbers)
			// Check if all elements are primitive (string, number, boolean)
			const allPrimitive = processedArray.every(item =>
				typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
			);

			if (allPrimitive) {
				// Sort primitive values alphabetically (case-insensitive for strings)
				return processedArray.sort((a, b) => {
					const aStr = String(a).toLowerCase();
					const bStr = String(b).toLowerCase();
					return aStr.localeCompare(bStr);
				});
			}

			// If array contains objects/arrays, don't sort the array order, just return processed items
			return processedArray;
		}

		// Handle objects - sort keys and recursively sort nested objects
		const sortedKeys = Object.keys(obj).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		);

		const sortedObj = {};
		sortedKeys.forEach(key => {
			sortedObj[key] = UrlDecoder.sortObjectKeys(obj[key]);
		});

		return sortedObj;
	},
	validateJsonRealTime: () => {
		const textarea = UrlDecoder.pageElements.textareaDecodedSearchParams;
		const paramsText = textarea.val().trim();

		// Empty is considered neutral (no validation styling)
		if (!paramsText) {
			textarea.removeClass('is-valid is-invalid');
			return;
		}

		try {
			// Try to parse the JSON (silent validation for real-time feedback)
			JSON.parse(paramsText);
			// If successful, show valid styling (green border)
			textarea.removeClass('is-invalid').addClass('is-valid');
		} catch (e) {
			// If JSON is invalid, show invalid styling (red border)
			// No console warning during real-time typing to avoid spam
			textarea.removeClass('is-valid').addClass('is-invalid');
		}
	},
	validateJsonWithWarning: () => {
		const textarea = UrlDecoder.pageElements.textareaDecodedSearchParams;
		const paramsText = textarea.val().trim();

		// Empty is considered neutral (no validation styling)
		if (!paramsText) {
			textarea.removeClass('is-valid is-invalid');
			return true; // Empty is valid
		}

		try {
			// Try to parse the JSON
			JSON.parse(paramsText);
			// If successful, show valid styling (green border)
			textarea.removeClass('is-invalid').addClass('is-valid');
			return true;
		} catch (e) {
			// If JSON is invalid, show invalid styling and log warning
			textarea.removeClass('is-valid').addClass('is-invalid');
			console.warn("Invalid JSON in parameters field:", e);
			return false;
		}
	}
};

UrlDecoder.load();