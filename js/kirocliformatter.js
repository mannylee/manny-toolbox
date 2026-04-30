var KiroCliFormatter = {
	name: "KiroCliFormatter",
	friendlyName: "Kiro-CLI Formatter",
	storageKeys: {
		outputMode: "kirocliformatter.outputMode"
	},
	pageElements: {},
	bindElements: () => {
		KiroCliFormatter.pageElements = {
			h2Title: $("#h2_title"),
			textareaInput: $("#textarea_input"),
			textareaOutput: $("#textarea_output"),
			divOutput: $("#div_output"),
			outputTextWrapper: $("#output_text_wrapper"),
			outputHtmlWrapper: $("#output_html_wrapper"),
			divCopyControls: $("#div_copy_controls"),
			buttonCopy: $("#button_copy"),
			spanCopyStatus: $("#span_copy_status"),
			radiosOutputMode: $("input[name='output_mode']")
		};
	},
	load: () => {
		// Update SPA
		SPA.variables.currentPageObject = KiroCliFormatter;
		KiroCliFormatter.bindElements();

		// Restore persisted output mode (default to "text")
		const savedMode = KiroCliFormatter.readSavedMode();
		KiroCliFormatter.applyMode(savedMode);
		$("#output_mode_" + savedMode).prop("checked", true);

		// Register listeners
		KiroCliFormatter.pageElements.textareaInput.on("keyup", KiroCliFormatter.processInput);
		KiroCliFormatter.pageElements.buttonCopy.on("click", KiroCliFormatter.copyToClipboard);
		KiroCliFormatter.pageElements.radiosOutputMode.on("change", KiroCliFormatter.onModeChange);

		// Format any pre-filled input without requiring a keypress
		KiroCliFormatter.processInput();

		// Ready
		CommonHelpers.logger.info("loaded successfully", KiroCliFormatter.name);
	},
	destroy: () => {
		KiroCliFormatter = null;
	},

	// =====================================================================
	// Mode persistence + UI plumbing
	// =====================================================================
	readSavedMode: () => {
		try {
			const v = localStorage.getItem(KiroCliFormatter.storageKeys.outputMode);
			// Default to rendered HTML when no preference has been stored.
			return v === "text" ? "text" : "html";
		} catch (e) {
			return "html";
		}
	},
	saveMode: (mode) => {
		try {
			localStorage.setItem(KiroCliFormatter.storageKeys.outputMode, mode);
		} catch (e) { /* no-op */ }
	},
	onModeChange: () => {
		const mode = $("input[name='output_mode']:checked").val() || "text";
		KiroCliFormatter.saveMode(mode);
		KiroCliFormatter.applyMode(mode);
		KiroCliFormatter.processInput();
	},
	applyMode: (mode) => {
		const showHtml = mode === "html";
		KiroCliFormatter.pageElements.outputTextWrapper.toggle(!showHtml);
		KiroCliFormatter.pageElements.outputHtmlWrapper.toggle(showHtml);
		KiroCliFormatter.pageElements.divCopyControls.toggle(showHtml);
	},
	processInput: () => {
		const input = KiroCliFormatter.pageElements.textareaInput.val();
		try {
			const blocks = KiroCliFormatter.parse(input);
			const mode = $("input[name='output_mode']:checked").val() || "text";
			if (mode === "html") {
				KiroCliFormatter.pageElements.divOutput.html(KiroCliFormatter.renderHtml(blocks));
			} else {
				KiroCliFormatter.pageElements.textareaOutput.val(KiroCliFormatter.renderText(blocks));
			}
		} catch (e) {
			CommonHelpers.logger.info(e.message, KiroCliFormatter.name);
		}
	},
	copyToClipboard: async () => {
		const node = KiroCliFormatter.pageElements.divOutput.get(0);
		if (!node) return;

		// Build both payloads from our own renderers so the plain-text side
		// is clean (our parser's output, not the browser's DOM-to-text
		// derivation). Slack Canvas and similar clients that prefer
		// text/plain get a Slack-friendly version; Outlook/Gmail keep the
		// styled HTML.
		const input = KiroCliFormatter.pageElements.textareaInput.val();
		const blocks = KiroCliFormatter.parse(input);
		// Clipboard gets the MINIMAL HTML (no inline styles, no <br>s).
		// The preview in the UI still uses the styled renderer so it looks
		// right on screen, but we don't want styled HTML on the clipboard
		// because Slack Canvas and some other clients treat dense inline
		// styling as a "this is code" signal.
		const html = KiroCliFormatter.renderHtmlMinimal(blocks);
		const text = KiroCliFormatter.renderText(blocks);

		const showStatus = (ok, msg) => {
			const status = KiroCliFormatter.pageElements.spanCopyStatus;
			// Toggle visibility (not display) so the span always reserves
			// its width. That keeps the Copy button anchored on the right
			// and prevents it from shifting when the status appears.
			status
				.stop(true, true)
				.removeClass("text-success text-danger")
				.addClass(ok ? "text-success" : "text-danger")
				.text(msg)
				.css({ visibility: "visible", opacity: 1 });
			setTimeout(() => {
				status.animate({ opacity: 0 }, 400, () => {
					status.css("visibility", "hidden");
				});
			}, 1500);
		};

		// Preferred path: modern Clipboard API with explicit text/html +
		// text/plain items. Supported in Chrome 86+, Safari 13.1+, FF 127+.
		if (navigator.clipboard && typeof ClipboardItem !== "undefined" &&
			navigator.clipboard.write) {
			try {
				const item = new ClipboardItem({
					"text/html":  new Blob([html], { type: "text/html"  }),
					"text/plain": new Blob([text], { type: "text/plain" })
				});
				await navigator.clipboard.write([item]);
				showStatus(true, "Copied");
				return;
			} catch (e) {
				CommonHelpers.logger.info(
					"clipboard.write failed, falling back to execCommand: " + (e.message || e),
					KiroCliFormatter.name);
				// fall through to legacy path
			}
		}

		// Legacy fallback: select the rendered DOM and use execCommand.
		// This path loses the custom text/plain override — the browser
		// derives text/plain from the DOM — but it still works as a rich
		// HTML copy for Outlook and similar.
		const range = document.createRange();
		range.selectNodeContents(node);
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
		let ok = false;
		try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
		selection.removeAllRanges();
		showStatus(ok, ok ? "Copied" : "Press Ctrl/Cmd+C");
	},

	// =====================================================================
	// Public entry point for the test harness (and anyone else)
	// =====================================================================
	// formatPlainText(input) and formatHtml(input) are pure functions that
	// transform a raw string into their respective output formats. The test
	// harness uses these to display side-by-side results.
	formatPlainText: (input) => {
		return KiroCliFormatter.renderText(KiroCliFormatter.parse(input));
	},
	formatHtml: (input) => {
		return KiroCliFormatter.renderHtml(KiroCliFormatter.parse(input));
	},

	// =====================================================================
	// STAGE 1 — Pre-normalisation
	// =====================================================================
	// Strip blockquote prefixes (│) entirely, normalise line endings, and
	// remove the common leading indentation that Kiro-CLI adds to every line
	// of its output.
	preNormalise: (input) => {
		if (typeof input !== "string") return "";
		// Normalise CR / CRLF → LF
		let s = input.replace(/\r\n?/g, "\n");

		// Strip blockquote prefixes: any line that, after optional leading
		// whitespace, starts with │ — remove the prefix AND a single space
		// after it if present. A line consisting of just the prefix becomes
		// a blank line. Skip lines that look like part of a box-drawing
		// table (they use the same │ character for cell separators).
		s = s.split("\n").map(line => {
			if (KiroCliFormatter.isTableLine(line)) return line;
			const m = line.match(/^[ \t]*│ ?(.*)$/);
			return m ? m[1] : line;
		}).join("\n");

		return s;
	},

	// =====================================================================
	// STAGE 2 — Em-dash and en-dash normalisation
	// =====================================================================
	// Rules:
	//   - "word — word" (spaces on both sides): comma + space
	//   - "word—word" / "word–word" (no spaces): hyphen
	//   - Leading "— item" in a line: becomes "- " (bullet)
	// Applied per-line before parsing so list detection sees normal markers.
	normaliseDashes: (line) => {
		// Leading em/en-dash used as a bullet marker
		let out = line.replace(/^([ \t]*)[—–]\s+/, "$1- ");
		// Tight (no-space) em/en-dashes → hyphen
		out = out.replace(/([^\s])[—–]([^\s])/g, "$1-$2");
		// Spaced em/en-dashes → comma + space (consume surrounding spaces)
		out = out.replace(/\s+[—–]\s+/g, ", ");
		return out;
	},

	// =====================================================================
	// STAGE 3 — Block parser
	// =====================================================================
	// Groups lines into typed blocks:
	//   { type: "paragraph", text: "..." }
	//   { type: "list",      ordered: bool, items: ["...", "..."] }
	//   { type: "table",     rows: [[cell, cell, ...], ...], hasHeader: bool }
	parse: (input) => {
		const normalised = KiroCliFormatter.preNormalise(input);
		const rawLines = normalised.split("\n");

		// Strip leading whitespace from each non-table line. Table lines
		// (identified by box-drawing chars) keep their structure — we detect
		// them first, before indentation is lost.
		const lines = rawLines.map(l => {
			if (KiroCliFormatter.isTableLine(l)) return l.replace(/^[ \t]+/, "");
			return KiroCliFormatter.normaliseDashes(l.replace(/^[ \t]+/, ""));
		});

		const blocks = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];

			// Skip blank lines
			if (line.trim() === "") { i++; continue; }

			// Table block
			if (KiroCliFormatter.isTableBorderLine(line)) {
				const end = KiroCliFormatter.findTableEnd(lines, i);
				const table = KiroCliFormatter.parseTable(lines.slice(i, end));
				if (table) blocks.push(table);
				i = end;
				continue;
			}

			// Unordered list
			if (KiroCliFormatter.isUnorderedItem(line)) {
				const { items, next } = KiroCliFormatter.collectListItems(lines, i, false);
				blocks.push({ type: "list", ordered: false, items });
				i = next;
				continue;
			}

			// Ordered list — but only if there are 2+ consecutive numbered items.
			// A single numbered line is treated as a header/paragraph.
			if (KiroCliFormatter.isOrderedItem(line)) {
				const lookahead = KiroCliFormatter.peekOrderedRun(lines, i);
				if (lookahead.count >= 2) {
					const { items, next } = KiroCliFormatter.collectListItems(lines, i, true);
					blocks.push({ type: "list", ordered: true, items });
					i = next;
					continue;
				}
				// fall through — treat as a paragraph
			}

			// Default: paragraph. Gather the current line plus any immediately
			// following non-blank, non-structural lines as soft-wrapped text.
			const { text, next } = KiroCliFormatter.collectParagraph(lines, i);
			blocks.push({ type: "paragraph", text });
			i = next;
		}
		return blocks;
	},

	// --- Line classifiers ---------------------------------------------------
	isBlank: (line) => line.trim() === "",
	isUnorderedItem: (line) => /^[-*•]\s+\S/.test(line),
	isOrderedItem: (line) => /^\d+\.\s+\S/.test(line),
	isStructuralLine: (line) => (
		KiroCliFormatter.isUnorderedItem(line) ||
		KiroCliFormatter.isOrderedItem(line) ||
		KiroCliFormatter.isTableLine(line)
	),
	// Any line containing box-drawing characters (borders or content with │)
	isTableLine: (line) => /[┌┐└┘├┤┬┴┼─]/.test(line) || (line.match(/│/g) || []).length >= 2,
	// Border rows only (no prose content inside)
	isTableBorderLine: (line) => /^[┌┐└┘├┤┬┴┼─\s]+$/.test(line) && /[┌└├]/.test(line),

	// --- Collectors ---------------------------------------------------------
	collectParagraph: (lines, start) => {
		const parts = [lines[start]];
		let i = start + 1;
		while (i < lines.length) {
			const l = lines[i];
			if (KiroCliFormatter.isBlank(l)) break;
			if (KiroCliFormatter.isStructuralLine(l)) break;
			parts.push(l);
			i++;
		}
		return { text: parts.join(" ").replace(/\s+/g, " ").trim(), next: i };
	},
	collectListItems: (lines, start, ordered) => {
		const items = [];
		let i = start;
		const isItem = ordered ? KiroCliFormatter.isOrderedItem : KiroCliFormatter.isUnorderedItem;
		while (i < lines.length) {
			const l = lines[i];
			if (KiroCliFormatter.isBlank(l)) { i++; break; }
			if (!isItem(l)) break;
			// Strip marker
			let text = ordered
				? l.replace(/^\d+\.\s+/, "")
				: l.replace(/^[-*•]\s+/, "");
			// Accumulate continuation lines (non-blank, non-structural)
			i++;
			while (i < lines.length) {
				const cont = lines[i];
				if (KiroCliFormatter.isBlank(cont)) break;
				if (KiroCliFormatter.isStructuralLine(cont)) break;
				text += " " + cont;
				i++;
			}
			items.push(text.replace(/\s+/g, " ").trim());
		}
		return { items, next: i };
	},
	// Count how many consecutive ordered-item lines start at index `start`,
	// allowing blank and continuation lines between markers.
	peekOrderedRun: (lines, start) => {
		let count = 0;
		let i = start;
		while (i < lines.length) {
			if (KiroCliFormatter.isBlank(lines[i])) { i++; continue; }
			if (KiroCliFormatter.isOrderedItem(lines[i])) {
				count++;
				i++;
				// Skip continuation lines
				while (i < lines.length &&
					!KiroCliFormatter.isBlank(lines[i]) &&
					!KiroCliFormatter.isStructuralLine(lines[i])) { i++; }
				continue;
			}
			break;
		}
		return { count };
	},

	// --- Table parsing ------------------------------------------------------
	findTableEnd: (lines, start) => {
		let i = start;
		while (i < lines.length && KiroCliFormatter.isTableLine(lines[i])) i++;
		return i;
	},
	parseTable: (tableLines) => {
		// Build a sequence of "groups" where each group is a run of content
		// rows between two separator lines. A group can wrap across multiple
		// physical lines; we merge them into one logical row.
		const groups = []; // each group: array of cell-arrays (physical rows)
		let currentGroup = [];
		const flush = () => {
			if (currentGroup.length > 0) {
				groups.push(currentGroup);
				currentGroup = [];
			}
		};
		for (const line of tableLines) {
			if (KiroCliFormatter.isTableBorderLine(line)) { flush(); continue; }
			if (!line.includes("│")) continue;
			// Split on │. A typical content row is: "│ a │ b │ c │" → first and
			// last elements are empty/whitespace because of the leading/trailing
			// pipes; drop them.
			const parts = line.split("│");
			// Drop the first and last segments (outside the outer pipes).
			const inner = parts.slice(1, -1).map(s => s.trim());
			if (inner.length === 0) continue;
			currentGroup.push(inner);
		}
		flush();
		if (groups.length === 0) return null;

		// Merge each group's physical rows into one logical row.
		// For each cell position, join non-empty values with a single space.
		const merged = groups.map(group => {
			const width = Math.max(...group.map(r => r.length));
			const row = new Array(width).fill("");
			for (const physical of group) {
				for (let c = 0; c < physical.length; c++) {
					const v = physical[c];
					if (!v) continue;
					row[c] = row[c] ? row[c] + " " + v : v;
				}
			}
			return row;
		}).filter(r => r.some(cell => cell.length > 0));

		if (merged.length === 0) return null;

		return {
			type: "table",
			rows: merged,
			hasHeader: merged.length >= 2
		};
	},

	// =====================================================================
	// STAGE 4 — Renderers
	// =====================================================================
	renderText: (blocks) => {
		const parts = [];
		for (let i = 0; i < blocks.length; i++) {
			const b = blocks[i];
			const next = blocks[i + 1];
			let rendered;
			if (b.type === "paragraph") {
				rendered = KiroCliFormatter.stripInlineMarkdownForText(b.text);
			} else if (b.type === "list") {
				rendered = b.items.map((it, idx) => {
					const marker = b.ordered ? (idx + 1) + ". " : "- ";
					return marker + KiroCliFormatter.stripInlineMarkdownForText(it);
				}).join("\n");
			} else if (b.type === "table") {
				rendered = KiroCliFormatter.renderMarkdownTable(b);
			} else {
				rendered = "";
			}
			parts.push(rendered);
			// Separator: paragraph-immediately-followed-by-list uses a single
			// newline so header sits directly on top of the list with no gap.
			if (next) {
				const tight = b.type === "paragraph" && next.type === "list";
				parts.push(tight ? "\n" : "\n\n");
			}
		}
		return parts.join("");
	},
	renderHtml: (blocks) => {
		// Inline styles keep Outlook and Slack from inheriting their default
		// paragraph/list margins, which would otherwise make the output look
		// 1.5x-spaced on paste. We keep all block-level margins at 0 and
		// emit a single <br> between blocks where a visual gap belongs.
		const pStyle  = ' style="margin:0;"';
		const ulStyle = ' style="margin:0;padding-left:1.5em;"';
		const olStyle = ' style="margin:0;padding-left:1.5em;"';
		const liStyle = ' style="margin:0;"';
		const tableStyle = ' style="border-collapse:collapse;margin:0;"';

		const parts = [];
		for (let i = 0; i < blocks.length; i++) {
			const b = blocks[i];
			const next = blocks[i + 1];
			if (b.type === "paragraph") {
				parts.push("<p" + pStyle + ">" + KiroCliFormatter.renderInlineHtml(b.text) + "</p>");
			} else if (b.type === "list") {
				const tag = b.ordered ? "ol" : "ul";
				const listStyle = b.ordered ? olStyle : ulStyle;
				const items = b.items.map(it =>
					"<li" + liStyle + ">" + KiroCliFormatter.renderInlineHtml(it) + "</li>"
				).join("");
				parts.push("<" + tag + listStyle + ">" + items + "</" + tag + ">");
			} else if (b.type === "table") {
				parts.push(KiroCliFormatter.renderHtmlTable(b, tableStyle));
			}
			// Visual separator: one blank line between blocks, EXCEPT when a
			// paragraph is immediately followed by a list (header → list
			// should sit tight, per spec).
			if (next) {
				const tight = b.type === "paragraph" && next.type === "list";
				if (!tight) parts.push("<br>");
			}
		}
		return parts.join("");
	},

	// --- Inline markdown ----------------------------------------------------
	// HTML: escape first, then apply bold/italic/code/link transforms on the
	// escaped string. Order matters: code first (its contents are verbatim),
	// then links, then bold, then italic.
	renderInlineHtml: (text) => {
		let s = KiroCliFormatter.escapeHtml(text);
		// Code: `code` → <code>code</code>. The backtick is not escaped by
		// escapeHtml, so matching is safe.
		s = s.replace(/`([^`]+)`/g, (_, c) => "<code>" + c + "</code>");
		// Links: [text](url) — url has been HTML-escaped already, so < and >
		// can't appear, but we still restrict the url charset to avoid oddities.
		s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
			'<a href="' + u + '">' + t + "</a>");
		// Bold: **x**
		s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
		// Italic: *x* or _x_ (avoid matching leftover bold markers by
		// requiring the surrounding char not be *)
		s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
		s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<em>$2</em>");
		return s;
	},
	// Plain-text: strip markdown decorations, keep the text. Links render as
	// "text (url)". Code content is kept as-is without backticks.
	stripInlineMarkdownForText: (text) => {
		let s = text;
		s = s.replace(/`([^`]+)`/g, "$1");
		s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)");
		s = s.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
		s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1$2");
		s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2");
		return s;
	},
	escapeHtml: (str) => str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;"),

	// --- Tables -------------------------------------------------------------
	renderMarkdownTable: (table) => {
		const rows = table.rows;
		if (rows.length === 0) return "";
		const headerRow = rows[0];
		const bodyRows = table.hasHeader ? rows.slice(1) : rows;
		const lines = [];
		lines.push("| " + headerRow.join(" | ") + " |");
		lines.push("|" + headerRow.map(() => " --- ").join("|") + "|");
		for (const r of bodyRows) lines.push("| " + r.join(" | ") + " |");
		return lines.join("\n");
	},
	// Semantic / minimal HTML renderer used for the clipboard. No inline
	// styles, no <br> between blocks. Lets the receiving client (Outlook,
	// Slack, etc.) apply its own defaults. Slack's "this is code" heuristic
	// is less trigger-happy when the HTML is sparse and semantic.
	//
	// Special case: ordered lists (<ol>) are flattened into paragraphs with
	// "1. " / "2. " prefixes. Slack Canvas wraps ordered lists in a code
	// block regardless of styling (probably mistaking them for numbered
	// log output), so we emit them as regular paragraphs instead. Outlook
	// and Gmail still render them as a numbered list visually — just without
	// the native <ol> semantics.
	renderHtmlMinimal: (blocks) => {
		const parts = [];
		for (const b of blocks) {
			if (b.type === "paragraph") {
				parts.push("<p>" + KiroCliFormatter.renderInlineHtml(b.text) + "</p>");
			} else if (b.type === "list" && b.ordered) {
				b.items.forEach((it, idx) => {
					parts.push("<p>" + (idx + 1) + ". " + KiroCliFormatter.renderInlineHtml(it) + "</p>");
				});
			} else if (b.type === "list") {
				const items = b.items.map(it =>
					"<li>" + KiroCliFormatter.renderInlineHtml(it) + "</li>"
				).join("");
				parts.push("<ul>" + items + "</ul>");
			} else if (b.type === "table") {
				parts.push(KiroCliFormatter.renderHtmlTableMinimal(b));
			}
		}
		return parts.join("");
	},
	renderHtmlTableMinimal: (table) => {
		const rows = table.rows;
		if (rows.length === 0) return "";
		const parts = ['<table border="1" cellspacing="0" cellpadding="4">'];
		const headerRow = rows[0];
		const bodyRows = table.hasHeader ? rows.slice(1) : rows;
		if (table.hasHeader) {
			parts.push("<thead><tr>");
			for (const c of headerRow) {
				parts.push("<th>" + KiroCliFormatter.renderInlineHtml(c) + "</th>");
			}
			parts.push("</tr></thead>");
		}
		parts.push("<tbody>");
		for (const r of bodyRows) {
			parts.push("<tr>");
			for (const c of r) {
				parts.push("<td>" + KiroCliFormatter.renderInlineHtml(c) + "</td>");
			}
			parts.push("</tr>");
		}
		parts.push("</tbody></table>");
		return parts.join("");
	},
	renderHtmlTable: (table, tableStyleAttr) => {
		const rows = table.rows;
		if (rows.length === 0) return "";
		// Minimal table markup. Inline styles ensure borders collapse and
		// no stray margins appear when pasted into Outlook. Slack ignores
		// tables and flattens them into cell text; that's a client limit.
		const tdStyle = ' style="margin:0;padding:4px;border:1px solid #999;"';
		const thStyle = ' style="margin:0;padding:4px;border:1px solid #999;text-align:left;"';
		const tableOpen = '<table cellspacing="0" cellpadding="0"' + (tableStyleAttr || ' style="border-collapse:collapse;margin:0;"') + ">";
		const parts = [tableOpen];
		const headerRow = rows[0];
		const bodyRows = table.hasHeader ? rows.slice(1) : rows;
		if (table.hasHeader) {
			parts.push("<thead><tr>");
			for (const c of headerRow) {
				parts.push("<th" + thStyle + ">" + KiroCliFormatter.renderInlineHtml(c) + "</th>");
			}
			parts.push("</tr></thead>");
		}
		parts.push("<tbody>");
		for (const r of bodyRows) {
			parts.push("<tr>");
			for (const c of r) {
				parts.push("<td" + tdStyle + ">" + KiroCliFormatter.renderInlineHtml(c) + "</td>");
			}
			parts.push("</tr>");
		}
		parts.push("</tbody></table>");
		return parts.join("");
	}
};

KiroCliFormatter.load();
