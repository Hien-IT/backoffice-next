# Builds the Content-Security-Policy that Directus 11.17.4 sends for /admin (directus/api/src/app.ts:166-195: helmet
# with useDefaults, merged by lodash with CONTENT_SECURITY_POLICY_*), from `env | sort` on stdin. Rules measured on
# Directus 11.17.4 (specs/019-deployment-packaging/research.md, T022):
# - Directus directives first, then the variables in env order, then the helmet defaults not set yet;
# - a list value ("array:a,b" or "a,b") overrides a Directus list item by item (lodash merge), a single value replaces it;
# - `false` stops Directus from starting: skipped here with a warning, like the other unsupported variables.

function warn(msg) { print "40-config.sh: " msg > "/dev/stderr" }

function add(name, value) {
	if (!(name in val)) order[++n] = name
	val[name] = value
}

BEGIN {
	add("script-src", "'self' 'unsafe-eval'")
	add("worker-src", "'self' blob:")
	add("child-src", "'self' blob:")
	add("img-src", "'self' data: blob: https://raw.githubusercontent.com https://avatars.githubusercontent.com")
	add("media-src", "'self'")
	add("connect-src", "'self' https://* wss://*")
	for (name in val) directus[name] = 1
}

/^CONTENT_SECURITY_POLICY_/ {
	eq = index($0, "=")
	key = substr($0, 1, eq - 1)
	value = substr($0, eq + 1)

	if (key == "CONTENT_SECURITY_POLICY_USE_DEFAULTS") {
		if (value == "false") nodefaults = 1
		next
	}
	if (key !~ /^CONTENT_SECURITY_POLICY_DIRECTIVES__[A-Z0-9_]+$/) { warn(key " is not supported, ignored"); next }
	if (value == "" || value == "false") { warn(key "=" value " is not supported (Directus does not start), ignored"); next }
	if (value ~ /["$\\]/) { warn(key " has a character nginx cannot hold (\" $ \\), ignored"); next }

	name = tolower(substr(key, 37))
	gsub(/_/, "-", name)
	list = sub(/^array:/, "", value) || index(value, ",") > 0
	count = split(value, items, ",")

	if (name in directus && list) {
		bcount = split(val[name], base, " ")
		merged = ""
		for (i = 1; i <= (count > bcount ? count : bcount); i++)
			merged = merged (i > 1 ? " " : "") (i <= count ? items[i] : base[i])
		value = merged
	} else {
		gsub(/,/, " ", value)
	}
	add(name, value)
}

END {
	if (!nodefaults) {
		split("default-src|base-uri|font-src|form-action|frame-ancestors|object-src|script-src-attr|style-src", names, "|")
		split("'self'|'self'|'self' https: data:|'self'|'self'|'none'|'none'|'self' https: 'unsafe-inline'", values, "|")
		for (i = 1; i in names; i++) if (!(names[i] in val)) add(names[i], values[i])
	}
	# Spec 020 (FR-062): the hash of the import map and the API origin (variables set by 40-config.sh).
	if (importmap != "") val["script-src"] = val["script-src"] " 'sha256-" importmap "'"
	if (api != "") val["script-src"] = val["script-src"] " " api
	for (i = 1; i <= n; i++) out = out (i > 1 ? ";" : "") order[i] " " val[order[i]]
	print out
}
