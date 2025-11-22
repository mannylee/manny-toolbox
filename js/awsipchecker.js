let AwsIpChecker = {
	name: "AwsIpChecker",
	friendlyName: "AWS IP Range Checker",
	pageElements: {
		h2Title: $("#h2_title"),
		inputIpAddress: $("#input_ip_address"),
		btnLookup: $("#btn_lookup"),
		btnClear: $("#btn_clear"),
		btnRefresh: $("#btn_refresh"),
		divResults: $("#div_results"),
		badgeDataStatus: $("#badge_data_status")
	},
	variables: {
		awsData: null,
		lastSyncTime: null,
		currentMatches: [],
		updateTimerInterval: null
	},
	config: {
		apiUrl: "https://ip-ranges.amazonaws.com/ip-ranges.json",
		cacheKey: "aws_ip_ranges_data",
		cacheTimestampKey: "aws_ip_ranges_timestamp",
		cacheTTL: 24 * 60 * 60 * 1000,
		maxMatchesToDisplay: 10
	},
	load: () => {
		// Update SPA
		SPA.variables.currentPageObject = AwsIpChecker;

		// Register listeners
		AwsIpChecker.pageElements.btnLookup.on("click", AwsIpChecker.lookupIpAddress);
		AwsIpChecker.pageElements.btnClear.on("click", AwsIpChecker.clearResults);
		AwsIpChecker.pageElements.btnRefresh.on("click", AwsIpChecker.clearCache);
		AwsIpChecker.pageElements.inputIpAddress.on("keypress", function (e) {
			if (e.which === 13) {
				AwsIpChecker.lookupIpAddress();
			}
		});
		AwsIpChecker.pageElements.inputIpAddress.on("keyup", AwsIpChecker.autoLookup);

		// Load AWS data
		AwsIpChecker.fetchAwsIpRanges();

		// Start the update timer
		AwsIpChecker.startUpdateTimer();

		// Ready
		CommonHelpers.logger.info("loaded successfully", AwsIpChecker.name);
	},
	destroy: () => {
		// Clear the update timer
		if (AwsIpChecker.variables.updateTimerInterval) {
			clearInterval(AwsIpChecker.variables.updateTimerInterval);
		}
		AwsIpChecker = null;
	},

	// Core functions
	fetchAwsIpRanges: () => {
		const cachedData = AwsIpChecker.checkCache();
		
		if (cachedData) {
			AwsIpChecker.awsData = cachedData.data;
			AwsIpChecker.lastSyncTime = cachedData.timestamp;
			AwsIpChecker.updateDataStatus();
			CommonHelpers.logger.info("Loaded AWS IP ranges from cache", AwsIpChecker.name);
		} else {
			AwsIpChecker.pageElements.badgeDataStatus.text("Loading data...");
			
			fetch(AwsIpChecker.config.apiUrl)
				.then(response => response.json())
				.then(data => {
					AwsIpChecker.awsData = data;
					AwsIpChecker.lastSyncTime = Date.now();
					AwsIpChecker.saveToCache(data);
					AwsIpChecker.updateDataStatus();
					CommonHelpers.logger.info("Loaded AWS IP ranges from API", AwsIpChecker.name);
				})
				.catch(error => {
					CommonHelpers.logger.log("Error fetching AWS IP ranges: " + error, AwsIpChecker.name);
					AwsIpChecker.pageElements.badgeDataStatus.text("Error loading data");
					AwsIpChecker.pageElements.badgeDataStatus.removeClass("bg-secondary").addClass("bg-danger");
				});
		}
	},
	checkCache: () => {
		const cachedData = localStorage.getItem(AwsIpChecker.config.cacheKey);
		const cachedTimestamp = localStorage.getItem(AwsIpChecker.config.cacheTimestampKey);
		
		if (cachedData && cachedTimestamp) {
			const timestamp = parseInt(cachedTimestamp);
			const age = Date.now() - timestamp;
			
			if (age < AwsIpChecker.config.cacheTTL) {
				return {
					data: JSON.parse(cachedData),
					timestamp: timestamp
				};
			}
		}
		
		return null;
	},
	saveToCache: (data) => {
		try {
			localStorage.setItem(AwsIpChecker.config.cacheKey, JSON.stringify(data));
			localStorage.setItem(AwsIpChecker.config.cacheTimestampKey, Date.now().toString());
		} catch (error) {
			CommonHelpers.logger.log("Error saving to cache: " + error, AwsIpChecker.name);
		}
	},
	clearCache: () => {
		localStorage.removeItem(AwsIpChecker.config.cacheKey);
		localStorage.removeItem(AwsIpChecker.config.cacheTimestampKey);
		AwsIpChecker.awsData = null;
		AwsIpChecker.lastSyncTime = null;
		AwsIpChecker.clearResults();
		AwsIpChecker.fetchAwsIpRanges();
		CommonHelpers.logger.info("Cache cleared, fetching fresh data", AwsIpChecker.name);
	},

	// Lookup functions
	autoLookup: () => {
		const ipAddress = AwsIpChecker.pageElements.inputIpAddress.val().trim();
		
		if (!ipAddress || !AwsIpChecker.awsData) {
			return;
		}
		
		const ipType = AwsIpChecker.validateIpAddress(ipAddress);
		
		if (ipType) {
			// Valid IP detected, trigger lookup
			AwsIpChecker.lookupIpAddress();
		}
	},
	lookupIpAddress: () => {
		const ipAddress = AwsIpChecker.pageElements.inputIpAddress.val().trim();
		
		if (!ipAddress) {
			AwsIpChecker.displayError("Please enter an IP address");
			return;
		}
		
		if (!AwsIpChecker.awsData) {
			AwsIpChecker.displayError("AWS data not loaded yet. Please wait...");
			return;
		}
		
		const ipType = AwsIpChecker.validateIpAddress(ipAddress);
		
		if (!ipType) {
			AwsIpChecker.displayError("Invalid IP address format. Please enter a valid IPv4 or IPv6 address.");
			return;
		}
		
		const matches = AwsIpChecker.findMatchingRanges(ipAddress, ipType);
		
		if (matches.length > 0) {
			AwsIpChecker.displayMatches(ipAddress, matches);
		} else {
			AwsIpChecker.displayNoMatch(ipAddress);
		}
	},
	validateIpAddress: (ip) => {
		// IPv4 regex
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
		// IPv6 regex (simplified)
		const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
		
		if (ipv4Regex.test(ip)) {
			const parts = ip.split('.');
			if (parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255)) {
				return 'ipv4';
			}
		}
		
		if (ipv6Regex.test(ip)) {
			return 'ipv6';
		}
		
		return null;
	},
	findMatchingRanges: (ip, ipType) => {
		const matches = [];
		const prefixes = ipType === 'ipv4' ? AwsIpChecker.awsData.prefixes : AwsIpChecker.awsData.ipv6_prefixes;
		const cidrKey = ipType === 'ipv4' ? 'ip_prefix' : 'ipv6_prefix';
		
		for (const prefix of prefixes) {
			if (AwsIpChecker.isIpInCidr(ip, prefix[cidrKey], ipType)) {
				matches.push({
					cidr: prefix[cidrKey],
					service: prefix.service,
					region: prefix.region,
					networkBorderGroup: prefix.network_border_group
				});
				
				if (matches.length >= AwsIpChecker.config.maxMatchesToDisplay) {
					break;
				}
			}
		}
		
		return matches;
	},
	isIpInCidr: (ip, cidr, ipType) => {
		if (ipType === 'ipv4') {
			return AwsIpChecker.isIpv4InCidr(ip, cidr);
		} else {
			return AwsIpChecker.isIpv6InCidr(ip, cidr);
		}
	},
	isIpv4InCidr: (ip, cidr) => {
		const [range, bits] = cidr.split('/');
		const mask = ~(2 ** (32 - parseInt(bits)) - 1);
		
		const ipLong = AwsIpChecker.ipv4ToLong(ip);
		const rangeLong = AwsIpChecker.ipv4ToLong(range);
		
		return (ipLong & mask) === (rangeLong & mask);
	},
	isIpv6InCidr: (ip, cidr) => {
		// Simplified IPv6 check - expand and compare
		const [range, bits] = cidr.split('/');
		const prefixLength = parseInt(bits);
		
		const ipExpanded = AwsIpChecker.expandIpv6(ip);
		const rangeExpanded = AwsIpChecker.expandIpv6(range);
		
		// Compare hex strings up to prefix length
		const hexCharsToCompare = Math.ceil(prefixLength / 4);
		
		return ipExpanded.substring(0, hexCharsToCompare) === rangeExpanded.substring(0, hexCharsToCompare);
	},

	// Display functions
	displayMatches: (ip, matches) => {
		const matchCount = matches.length;
		const maxReached = matchCount >= AwsIpChecker.config.maxMatchesToDisplay;
		
		let html = `
			<div class="card border-success">
				<div class="card-body">
					<h5 class="card-title text-success">
						<i class="bi bi-check-circle"></i> IP Address Found in AWS Ranges
						${maxReached ? ` (showing first ${matchCount})` : ` (${matchCount} match${matchCount > 1 ? 'es' : ''})`}
					</h5>
					<p class="mb-3"><strong>IP Address:</strong> ${ip}</p>
		`;
		
		matches.forEach((match, index) => {
			const range = AwsIpChecker.getCidrRange(match.cidr);
			html += `
				<div class="mb-3 ${index > 0 ? 'border-top pt-3' : ''}">
					<h6>Match ${index + 1}:</h6>
					<p class="mb-1"><strong>CIDR Range:</strong> <code class="cidr-selectable" style="user-select: text; cursor: pointer;">${match.cidr}</code> <span style="color: #6c757d;">(${range.start} - ${range.end})</span></p>
					<p class="mb-1"><strong>Service:</strong> ${match.service}</p>
					<p class="mb-1"><strong>Region:</strong> ${match.region}</p>
					<p class="mb-0"><strong>Network Border Group:</strong> ${match.networkBorderGroup}</p>
				</div>
			`;
		});
		
		html += `
					<button id="btn_copy_result" class="btn btn-sm btn-outline-primary mt-2">Copy Results</button>
				</div>
			</div>
		`;
		
		AwsIpChecker.pageElements.divResults.html(html).show();
		AwsIpChecker.variables.currentMatches = matches;
		
		// Attach copy handler
		$("#btn_copy_result").on("click", AwsIpChecker.copyResultToClipboard);
		
		// Attach click-to-select handler for CIDR ranges
		$(".cidr-selectable").on("click", function(e) {
			e.stopPropagation();
			const range = document.createRange();
			range.selectNodeContents(this);
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		});
		
		// Clear selection when clicking outside CIDR elements
		$(document).on("click.cidr-deselect", function(e) {
			if (!$(e.target).hasClass("cidr-selectable")) {
				window.getSelection().removeAllRanges();
			}
		});
	},
	displayNoMatch: (ip) => {
		const html = `
			<div class="card border-danger">
				<div class="card-body">
					<h5 class="card-title text-danger">
						<i class="bi bi-x-circle"></i> No Match Found
					</h5>
					<p class="mb-0">The IP address <code>${ip}</code> is not in any AWS IP range.</p>
				</div>
			</div>
		`;
		
		AwsIpChecker.pageElements.divResults.html(html).show();
		AwsIpChecker.variables.currentMatches = [];
	},
	displayError: (message) => {
		const html = `
			<div class="card border-warning">
				<div class="card-body">
					<h5 class="card-title text-warning">
						<i class="bi bi-exclamation-triangle"></i> Invalid Input
					</h5>
					<p class="mb-0">${message}</p>
				</div>
			</div>
		`;
		
		AwsIpChecker.pageElements.divResults.html(html).show();
		AwsIpChecker.variables.currentMatches = [];
	},
	updateDataStatus: () => {
		if (!AwsIpChecker.lastSyncTime) {
			AwsIpChecker.pageElements.badgeDataStatus.text("No IP ranges loaded");
			return;
		}
		
		const age = Date.now() - AwsIpChecker.lastSyncTime;
		const hours = Math.floor(age / (1000 * 60 * 60));
		const minutes = Math.floor(age / (1000 * 60));
		
		let statusText;
		if (hours < 1) {
			if (minutes === 0) {
				statusText = "IP ranges loaded (just now)";
			} else if (minutes === 1) {
				statusText = "IP ranges loaded (1 minute ago)";
			} else {
				statusText = `IP ranges loaded (${minutes} minutes ago)`;
			}
		} else if (hours === 1) {
			statusText = "IP ranges loaded (1 hour ago)";
		} else {
			statusText = `IP ranges loaded (${hours} hours ago)`;
		}
		
		AwsIpChecker.pageElements.badgeDataStatus.text(statusText);
		AwsIpChecker.pageElements.badgeDataStatus.removeClass("bg-danger").addClass("bg-secondary");
	},
	startUpdateTimer: () => {
		// Clear any existing timer
		if (AwsIpChecker.variables.updateTimerInterval) {
			clearInterval(AwsIpChecker.variables.updateTimerInterval);
		}
		
		// Function to determine update interval based on age
		const getUpdateInterval = () => {
			if (!AwsIpChecker.lastSyncTime) {
				return 60000; // 1 minute default
			}
			
			const age = Date.now() - AwsIpChecker.lastSyncTime;
			const hours = Math.floor(age / (1000 * 60 * 60));
			
			// Update every minute if less than 1 hour old
			// Update every 10 minutes if 1 hour or older
			return hours < 1 ? 60000 : 600000;
		};
		
		// Initial update
		AwsIpChecker.updateDataStatus();
		
		// Set up recurring updates
		const updateAndReschedule = () => {
			AwsIpChecker.updateDataStatus();
			
			// Reschedule with potentially different interval
			const newInterval = getUpdateInterval();
			if (AwsIpChecker.variables.updateTimerInterval) {
				clearInterval(AwsIpChecker.variables.updateTimerInterval);
			}
			AwsIpChecker.variables.updateTimerInterval = setInterval(updateAndReschedule, newInterval);
		};
		
		// Start the timer with initial interval
		const initialInterval = getUpdateInterval();
		AwsIpChecker.variables.updateTimerInterval = setInterval(updateAndReschedule, initialInterval);
	},

	// Helper functions
	copyResultToClipboard: () => {
		const ip = AwsIpChecker.pageElements.inputIpAddress.val().trim();
		let text = `IP Address: ${ip}\n\n`;
		
		AwsIpChecker.variables.currentMatches.forEach((match, index) => {
			const range = AwsIpChecker.getCidrRange(match.cidr);
			text += `Match ${index + 1}:\n`;
			text += `CIDR Range: ${match.cidr} (${range.start} - ${range.end})\n`;
			text += `Service: ${match.service}\n`;
			text += `Region: ${match.region}\n`;
			text += `Network Border Group: ${match.networkBorderGroup}\n\n`;
		});
		
		navigator.clipboard.writeText(text).then(() => {
			const btn = $("#btn_copy_result");
			const originalText = btn.text();
			btn.text("Copied!");
			setTimeout(() => btn.text(originalText), 2000);
		});
	},
	clearResults: () => {
		AwsIpChecker.pageElements.inputIpAddress.val("");
		AwsIpChecker.pageElements.divResults.hide();
		AwsIpChecker.variables.currentMatches = [];
	},
	ipv4ToLong: (ip) => {
		return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
	},
	longToIpv4: (long) => {
		return [
			(long >>> 24) & 255,
			(long >>> 16) & 255,
			(long >>> 8) & 255,
			long & 255
		].join('.');
	},
	getCidrRange: (cidr) => {
		const [ip, bits] = cidr.split('/');
		const prefixLength = parseInt(bits);
		
		// Check if IPv6
		if (cidr.includes(':')) {
			// For IPv6, just return simplified range info
			return { start: 'IPv6 Start', end: 'IPv6 End' };
		}
		
		// IPv4 calculation
		const mask = ~(2 ** (32 - prefixLength) - 1);
		const ipLong = AwsIpChecker.ipv4ToLong(ip);
		const networkLong = (ipLong & mask) >>> 0;
		const broadcastLong = (networkLong | ~mask) >>> 0;
		
		return {
			start: AwsIpChecker.longToIpv4(networkLong),
			end: AwsIpChecker.longToIpv4(broadcastLong)
		};
	},
	expandIpv6: (ip) => {
		// Expand IPv6 address to full form
		const parts = ip.split(':');
		const emptyIndex = parts.indexOf('');
		
		if (emptyIndex !== -1) {
			const missing = 8 - parts.filter(p => p !== '').length;
			parts.splice(emptyIndex, 1, ...Array(missing + 1).fill('0'));
		}
		
		return parts.map(part => part.padStart(4, '0')).join('');
	},
	
	// Debug helper function - set cache age for testing
	setAwsCacheAge: (hoursAgo) => {
		const timestamp = Date.now() - (hoursAgo * 60 * 60 * 1000);
		localStorage.setItem(AwsIpChecker.config.cacheTimestampKey, timestamp.toString());
		console.log(`✓ Cache timestamp set to ${hoursAgo} hours ago`);
		console.log(`Reload the page to see: "Data loaded (${hoursAgo} hours ago)"`);
		console.log(`Note: If hoursAgo > 24, cache will be considered stale and fresh data will be fetched`);
	}
};

AwsIpChecker.load();
