/**
 * RecordSet-List-Sort
 *
 * Pure helpers for the OPT-IN sortable-column-header feature of the record set list. Kept free of view/DOM state
 * so the semantics -- which columns are sortable, the current sort parsed from the FoxHound filter string, the
 * click-toggle cycle, and rewriting the filter string -- are unit-testable on their own.
 *
 * Default behavior is unchanged: a column is sortable ONLY when the record set opts in with
 * RecordSetListSortable:true (whole list) or an individual column sets Sortable:true; a column can always opt out
 * with Sortable:false. The sort itself rides the existing FoxHound `FSF~<field>~<ASC|DESC>~0` stanza already
 * carried in the list's filter string, so there is no new transport -- a header click just rewrites that stanza
 * and re-navigates the list route.
 */

// A column is sortable when it opts in explicitly, or the whole list is sortable and the column has not opted out.
function columnIsSortable(pRecordSetConfiguration, pColumn)
{
	if (!pColumn) { return false; }
	if (pColumn.Sortable === true) { return true; }
	if (pColumn.Sortable === false) { return false; }
	return !!(pRecordSetConfiguration && pRecordSetConfiguration.RecordSetListSortable === true);
}

// Parse the active sort (if any) out of a list filter string -> { Field, Direction } or null. The filter string
// may arrive URI-encoded (it rides in the route), so decode defensively.
function parseSort(pFilterString)
{
	if (!pFilterString || typeof pFilterString !== 'string') { return null; }
	let tmpDecoded = pFilterString;
	try { tmpDecoded = decodeURIComponent(pFilterString); } catch (pDecodeError) { /* already decoded */ }
	let tmpMatch = /FSF~([^~]+)~(ASC|DESC)~/i.exec(tmpDecoded);
	if (!tmpMatch) { return null; }
	return { Field: tmpMatch[1], Direction: tmpMatch[2].toUpperCase() };
}

// The next sort state when a header is clicked: an unsorted column (or a different column) sorts ASC; ASC becomes
// DESC; DESC clears back to the natural order (null). A three-state cycle so a click can always undo itself.
function toggleSort(pCurrentSort, pKey)
{
	if (!pCurrentSort || pCurrentSort.Field !== pKey) { return { Field: pKey, Direction: 'ASC' }; }
	if (String(pCurrentSort.Direction).toUpperCase() === 'ASC') { return { Field: pKey, Direction: 'DESC' }; }
	return null;
}

// Rewrite a filter string's sort: strip any existing FSF stanza (fixed 4-token arity: FSF~field~dir~idx, so it
// is `~`-safe) and append the new one. Every other stanza (FBV filter clauses, etc.) is preserved untouched, so
// sorting composes with an active filter.
function applySort(pFilterString, pSort)
{
	let tmpDecoded = '';
	if (pFilterString && typeof pFilterString === 'string')
	{
		try { tmpDecoded = decodeURIComponent(pFilterString); } catch (pDecodeError) { tmpDecoded = pFilterString; }
	}
	let tmpStripped = tmpDecoded.replace(/~?FSF~[^~]+~[^~]+~[^~]+/gi, '');
	tmpStripped = tmpStripped.replace(/^~+/, '').replace(/~+$/, '');
	if (!pSort || !pSort.Field) { return tmpStripped; }
	let tmpSortStanza = 'FSF~' + pSort.Field + '~' + (String(pSort.Direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC') + '~0';
	return tmpStripped ? (tmpStripped + '~' + tmpSortStanza) : tmpSortStanza;
}

module.exports = { columnIsSortable, parseSort, toggleSort, applySort };
