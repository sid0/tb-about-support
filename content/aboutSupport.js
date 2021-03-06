/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 * 
 * The Original Code is aboutSupport.xhtml.
 * 
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *   Curtis Bartley <cbartley@mozilla.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let gPrefService = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService)
                     .QueryInterface(Ci.nsIPrefBranch2);
let gStringBundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                             .getService(Ci.nsIStringBundleService);
let gMessengerBundle = gStringBundleService.createBundle(
  "chrome://messenger/locale/messenger.properties");

Components.utils.import("resource://about-support/module.js");

/* Node classes. All of these are mutually exclusive. */

// Any nodes marked with this class will be considered part of the UI only,
// and therefore will not be copied. An element can be either CLASS_DATA_UIONLY
// or CLASS_DATA_PRIVATE, but not both.
// and therefore will not be copied.
const CLASS_DATA_UIONLY = "data-uionly";

// Any nodes marked with this class will be considered private and will be
// hidden if the user requests only public data to be shown or copied. An
// element can be either CLASS_DATA_PRIVATE or CLASS_DATA_UIONLY, but not both.
// hidden if the user requests only public data to be shown or copied.
const CLASS_DATA_PRIVATE = "data-private";

// Any nodes marked with this class will only be displayed when the user chooses
// to not display private data.
const CLASS_DATA_PUBLIC = "data-public";

const ELLIPSIS = gPrefService.getComplexValue("intl.ellipsis",
                                              Ci.nsIPrefLocalizedString).data;

// We use a preferences whitelist to make sure we only show preferences that
// are useful for support and won't compromise the user's privacy.  Note that
// entries are *prefixes*: for example, "accessibility." applies to all prefs
// under the "accessibility.*" branch.
const PREFS_WHITELIST = [
  "accessibility.",
  "browser.fixup.",
  "browser.history_expire_",
  "browser.link.open_newwindow",
  "browser.mousewheel.",
  "browser.places.",
  "browser.startup.homepage",
  "browser.tabs.",
  "browser.zoom.",
  "dom.",
  "extensions.checkCompatibility",
  "extensions.lastAppVersion",
  "font.",
  "general.useragent.",
  "gfx.color_management.mode",
  "javascript.",
  "keyword.",
  "layout.css.dpi",
  "mail.openMessageBehavior.",
  "mail.spotlight.",
  "mail.winsearch.",
  "mailnews.database.",
  "network.",
  "places.",
  "print.",
  "privacy.",
  "security."
];

// The blacklist, unlike the whitelist, is a list of regular expressions.
const PREFS_BLACKLIST = [
  /^network[.]proxy[.]/,
  /[.]print_to_filename$/,
  /[.]lastFolderIndexedUri/,
];

window.onload = function () {
  // Get the support URL.
  let urlFormatter = Cc["@mozilla.org/toolkit/URLFormatterService;1"]
                       .getService(Ci.nsIURLFormatter);
  let supportUrl = urlFormatter.formatURLPref("app.support.baseURL");

  // Update the application basics section.
  document.getElementById("application-box").textContent = Application.name;
  document.getElementById("version-box").textContent = Application.version;
  document.getElementById("useragent-box").textContent = navigator.userAgent;
  document.getElementById("supportLink").href = supportUrl;
  let propertiesService = Cc["@mozilla.org/file/directory_service;1"]
                            .getService(Ci.nsIProperties);
  let currProfD = propertiesService.get("ProfD", Ci.nsIFile);
  appendChildren(document.getElementById("profile-dir-box"),
    [createElement("a", currProfD.path,
      {"href": "#",
       "onclick": "openProfileDirectory(); event.preventDefault();"
      })]);

  let fsType;
  try {
    fsType = AboutSupport.getFileSystemType(currProfD);
  }
  catch (x) {
    Components.utils.reportError(x);
  }

  if (fsType) {
    let bundle = gStringBundleService.createBundle(
      "chrome://about-support/locale/aboutSupport.properties");
    let fsText = bundle.GetStringFromName("fsType." + fsType);
    document.getElementById("profile-fs-type-box").textContent = fsText;
  }

  let appInfo = Cc["@mozilla.org/xre/app-info;1"]
                  .getService(Ci.nsIXULAppInfo)
                  .QueryInterface(Ci.nsIXULRuntime);
  document.getElementById("buildid-box").textContent = appInfo.appBuildID;

  // Update the other sections.
  populateAccountsSection();
  populatePreferencesSection();
  populateExtensionsSection();
}

/**
 * A list of extensions. This is assigned to by populateExtensionsSection.
 */
var gExtensions;

/**
 * A list of fields for each extension.
 */
var gExtensionDetails = ["name", "version", "enabled", "id"];

function populateExtensionsSection() {
  gExtensions = Application.extensions.all;
  let trExtensions = [];
  for (let i = 0; i < gExtensions.length; i++) {
    let extension = gExtensions[i];
    let extensionTDs = [createElement("td", extension[prop])
                        for ([, prop] in Iterator(gExtensionDetails))];
    let tr = createParentElement("tr", extensionTDs);
    trExtensions.push(tr);
  }
  appendChildren(document.getElementById("extensions-tbody"), trExtensions);
}

/**
 * Returns a plaintext representation of extension data.
 */
function getExtensionsText(aHidePrivateData, aIndent) {
  let extensionData = [aIndent +
                       [extension[prop]
                        for ([, prop] in Iterator(gExtensionDetails))].join(", ")
                       for ([, extension] in Iterator(gExtensions))];
  return extensionData.join("\n");
}

// Invert nsMsgSocketType and nsMsgAuthMethod so that we can present something
// slightly more descriptive than a mere number. JS really should have object
// comprehensions :(
let gSocketTypes = {};
for each (let [str, index] in Iterator(Ci.nsMsgSocketType))
  gSocketTypes[index] = str;

function getSocketTypeText(aIndex) {
  let plainSocketType = (aIndex in gSocketTypes ?
                         gSocketTypes[aIndex] : aIndex);
  let prettySocketType;
  try {
    prettySocketType = gMessengerBundle.GetStringFromName(
      "smtpServer-ConnectionSecurityType-" + aIndex);
  }
  catch (e if e.result == Components.results.NS_ERROR_FAILURE) {
    // The string wasn't found in the bundle. Make do without it.
    prettySocketType = plainSocketType;
  }
  return {localized: prettySocketType, neutral: plainSocketType};
}

let gAuthMethods = {};
for each (let [str, index] in Iterator(Ci.nsMsgAuthMethod))
  gAuthMethods[index] = str;
// l10n properties in messenger.properties corresponding to each auth method
let gAuthMethodProperties = {
  "1": "authOld",
  "2": "authPasswordCleartextInsecurely",
  "3": "authPasswordCleartextViaSSL",
  "4": "authPasswordEncrypted",
  "5": "authKerberos",
  "6": "authNTLM",
  "8": "authAnySecure"
};

function getAuthMethodText(aIndex) {
  let prettyAuthMethod;
  let plainAuthMethod = (aIndex in gAuthMethods ?
                         gAuthMethods[aIndex] : aIndex);
  if (aIndex in gAuthMethodProperties) {
    prettyAuthMethod =
      gMessengerBundle.GetStringFromName(gAuthMethodProperties[aIndex]);
  }
  else {
    prettyAuthMethod = plainAuthMethod;
  }
  return {localized: prettyAuthMethod, neutral: plainAuthMethod};
}

/**
 * Coerces x into a string.
 */
function toStr(x) {
  return "" + x;
}

/**
 * Marks x as private (see below).
 */
function toPrivate(x) {
  return {localized: x, neutral: x, isPrivate: true};
}

/**
 * A list of fields for the incoming server of an account. Each element of the
 * list is a pair of [property name, transforming function]. The transforming
 * function should take the property and return either a string or an object
 * with the following properties:
 * - localized: the data in (possibly) localized form
 * - neutral: the data in language-neutral form
 * - isPrivate (optional): true if the data is private-only, false if public-only,
 *                         not stated otherwise
 */
var gIncomingDetails = [
  ["key", toStr],
  ["name", toPrivate],
  ["hostDetails", toStr],
  ["socketType", getSocketTypeText],
  ["authMethod", getAuthMethodText],
];

/**
 * A list of fields for the outgoing servers associated with an account. This is
 * similar to gIncomingDetails above.
 */
var gOutgoingDetails = [
  ["name", toStr],
  ["socketType", getSocketTypeText],
  ["authMethod", getAuthMethodText],
  ["isDefault", toStr],
];

/**
 * A list of account details.
 */
XPCOMUtils.defineLazyGetter(window, "gAccountDetails",
                            function () AboutSupport.getAccountDetails());

function populateAccountsSection() {
  let trAccounts = [];

  function createTD(data, rowSpan) {
    let text = (typeof data == "string") ? data : data.localized;
    let copyData = (typeof data == "string") ? null : data.neutral;
    let attributes = {rowspan: rowSpan};
    if (typeof data == "object" && "isPrivate" in data)
      attributes.class = data.isPrivate ? CLASS_DATA_PRIVATE : CLASS_DATA_PUBLIC;

    return createElement("td", text, attributes, copyData);
  }

  for (let [, account] in Iterator(gAccountDetails)) {
    // We want a minimum rowspan of 1
    let rowSpan = account.smtpServers.length || 1;
    // incomingTDs is a list of TDs
    let incomingTDs = [createTD(fn(account[prop]), rowSpan)
                       for ([, [prop, fn]] in Iterator(gIncomingDetails))];
    // outgoingTDs is a list of list of TDs
    let outgoingTDs = [[createTD(fn(smtp[prop]), 1)
                        for ([, [prop, fn]] in Iterator(gOutgoingDetails))]
                       for ([, smtp] in Iterator(account.smtpServers))];

    // If there are no SMTP servers, add a dummy element to make life easier below
    if (outgoingTDs.length == 0)
      outgoingTDs = [[]];

    // Add the first SMTP server to this tr.
    let tr = createParentElement("tr", incomingTDs.concat(outgoingTDs[0]));
    trAccounts.push(tr);
    // Add the remaining SMTP servers as separate trs
    for each (let [, tds] in Iterator(outgoingTDs.slice(1)))
      trAccounts.push(createParentElement("tr", tds));
  }

  appendChildren(document.getElementById("accounts-tbody"), trAccounts);
}

/**
 * Returns a plaintext representation of the accounts data.
 */
function getAccountText(aHidePrivateData, aIndent) {
  let accumulator = [];

  // Given a string or object, converts it into a language-neutral form 
  function neutralizer(data) {
    if (typeof data == "string")
      return data;
    if ("isPrivate" in data && (aHidePrivateData == data.isPrivate))
      return "";
    return data.neutral;
  }

  for (let [, account] in Iterator(gAccountDetails)) {
    accumulator.push(aIndent + account.key + ":");
    // incomingData is a list of strings
    let incomingData = [neutralizer(fn(account[prop]))
                        for ([, [prop, fn]] in Iterator(gIncomingDetails))];
    accumulator.push(aIndent + "  INCOMING: " + incomingData.join(", "));

    // outgoingData is a list of list of strings
    let outgoingData = [[neutralizer(fn(smtp[prop]))
                         for ([, [prop, fn]] in Iterator(gOutgoingDetails))]
                        for ([, smtp] in Iterator(account.smtpServers))];
    for (let [, data] in Iterator(outgoingData))
      accumulator.push(aIndent + "  OUTGOING: " + data.join(", "));

    accumulator.push("");
  }

  return accumulator.join("\n");
}

function populatePreferencesSection() {
  let modifiedPrefs = getModifiedPrefs();

  function comparePrefs(pref1, pref2) {
    if (pref1.name < pref2.name)
      return -1;
    if (pref1.name > pref2.name)
      return 1;
    return 0;
  }

  let sortedPrefs = modifiedPrefs.sort(comparePrefs);

  let trPrefs = [];
  sortedPrefs.forEach(function (pref) {
    let tdName = createElement("td", pref.name, {"class": "pref-name"});
    let tdValue = createElement("td", formatPrefValue(pref.value),
                                {"class": "pref-value"});
    let tr = createParentElement("tr", [tdName, tdValue]);
    trPrefs.push(tr);
  });

  appendChildren(document.getElementById("prefs-tbody"), trPrefs);
}

function formatPrefValue(prefValue) {
  // Some pref values are really long and don't have spaces.  This can cause
  // problems when copying and pasting into some WYSIWYG editors.  In general
  // the exact contents of really long pref values aren't particularly useful,
  // so we truncate them to some reasonable length.
  let maxPrefValueLen = 120;
  let text = "" + prefValue;
  if (text.length > maxPrefValueLen)
    text = text.substring(0, maxPrefValueLen) + ELLIPSIS;
  return text;
}

function getModifiedPrefs() {
  // We use the low-level prefs API to identify prefs that have been
  // modified, rather that Application.prefs.all since the latter is
  // much, much slower.  Application.prefs.all also gets slower each
  // time it's called.  See bug 517312.
  let prefNames = getWhitelistedPrefNames();
  let prefs = [Application.prefs.get(prefName)
                      for each (prefName in prefNames)
                          if (gPrefService.prefHasUserValue(prefName)
                            && !isBlacklisted(prefName))];
  return prefs;
}

function getWhitelistedPrefNames() {
  let results = [];
  PREFS_WHITELIST.forEach(function (prefStem) {
    let prefNames = gPrefService.getChildList(prefStem, {});
    results = results.concat(prefNames);
  });
  return results;
}

function isBlacklisted(prefName) {
  return PREFS_BLACKLIST.some(function (re) re.test(prefName));
}

function createParentElement(tagName, childElems) {
  let elem = document.createElement(tagName);
  appendChildren(elem, childElems);
  return elem;
}

function userDataHandler(aOp, aKey, aData, aSrc, aDest) {
  if (aOp == UserDataHandler.NODE_CLONED || aOp == UserDataHandler.NODE_IMPORTED)
    aDest.setUserData(aKey, aData, userDataHandler);
}

function onShowPrivateDataChange(aCheckbox) {
  document.getElementById("about-support-private").disabled = aCheckbox.checked;
}

function createElement(tagName, textContent, opt_attributes, opt_copyData) {
  if (opt_attributes == null)
    opt_attributes = [];
  let elem = document.createElement(tagName);
  elem.textContent = textContent;
  for each (let [key, value] in Iterator(opt_attributes))
    elem.setAttribute(key, "" + value);

  if (opt_copyData != null) {
    // Look for the (only) text node.
    let textNode = elem.firstChild;
    while (textNode && textNode.nodeType != Node.TEXT_NODE)
      textNode = textNode.nextSibling;
    // XXX warn here if textNode not found
    if (textNode)
      textNode.setUserData("copyData", opt_copyData, userDataHandler);
  }


  return elem;
}

function appendChildren(parentElem, childNodes) {
  for (let i = 0; i < childNodes.length; i++)
    parentElem.appendChild(childNodes[i]);
}

/**
 * Create warning text to add to any private data.
 * @returns A HTML paragraph node containing the warning.
 */
function createWarning() {
  let bundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                        .getService(Ci.nsIStringBundleService);
  let bundle = bundleService.createBundle(
    "chrome://about-support/locale/aboutSupport.properties");
  return createParentElement("p", [
    createElement("strong", bundle.GetStringFromName("warningLabel")),
    // Add some whitespace between the label and the text
    document.createTextNode(" "),
    document.createTextNode(bundle.GetStringFromName("warningText")),
  ]);
}

function copyToClipboard() {
  // Get the HTML and text representations for the important part of the page.
  let hidePrivateData = !document.getElementById("check-show-private-data").checked;
  let contentsDiv = createCleanedUpContents(hidePrivateData);
  let dataHtml = contentsDiv.innerHTML;
  let dataText = createTextForElement(contentsDiv, hidePrivateData);

  // We can't use plain strings, we have to use nsSupportsString.
  let supportsStringClass = Cc["@mozilla.org/supports-string;1"];
  let ssHtml = supportsStringClass.createInstance(Ci.nsISupportsString);
  let ssText = supportsStringClass.createInstance(Ci.nsISupportsString);

  let transferable = Cc["@mozilla.org/widget/transferable;1"]
                       .createInstance(Ci.nsITransferable);

  // Add the HTML flavor.
  transferable.addDataFlavor("text/html");
  ssHtml.data = dataHtml;
  transferable.setTransferData("text/html", ssHtml, dataHtml.length * 2);

  // Add the plain text flavor.
  transferable.addDataFlavor("text/unicode");
  ssText.data = dataText;
  transferable.setTransferData("text/unicode", ssText, dataText.length * 2);

  // Store the data into the clipboard.
  let clipboard = Cc["@mozilla.org/widget/clipboard;1"]
                    .getService(Ci.nsIClipboard);
  clipboard.setData(transferable, null, clipboard.kGlobalClipboard);
}

function sendViaEmail() {
  // Get the HTML representation for the important part of the page.
  let hidePrivateData = !document.getElementById("check-show-private-data").checked;
  let contentsDiv = createCleanedUpContents(hidePrivateData);
  let dataHtml = contentsDiv.innerHTML;
  // The editor considers whitespace to be significant, so replace all
  // whitespace with a single space.
  dataHtml = dataHtml.replace(/\s+/g, " ");

  // Set up parameters and fields to use for the compose window.
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.type = Ci.nsIMsgCompType.New;
  params.format = Ci.nsIMsgCompFormat.HTML;

  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  fields.forcePlainText = false;
  fields.body = dataHtml;
  // In general we can have non-ASCII characters, and compose's charset
  // detection doesn't seem to work when the HTML part is pure ASCII but the
  // text isn't. So take the easy way out and force UTF-8.
  fields.characterSet = "UTF-8";
  fields.bodyIsAsciiOnly = false;
  params.composeFields = fields;

  // Our params are set up. Now open a compose window.
  let composeService = Cc["@mozilla.org/messengercompose;1"]
                         .getService(Ci.nsIMsgComposeService);
  composeService.OpenComposeWindowWithParams(null, params);
}

function createCleanedUpContents(aHidePrivateData) {
  // Get the important part of the page.
  let contentsDiv = document.getElementById("contents");
  // Deep-clone the entire div.
  let clonedDiv = contentsDiv.cloneNode(true);
  // Go in and replace text with the text we actually want to copy.
  // (this mutates the cloned node)
  cleanUpText(clonedDiv, aHidePrivateData);
  // Insert a warning if we need to
  if (!aHidePrivateData)
    clonedDiv.insertBefore(createWarning(), clonedDiv.firstChild);
  return clonedDiv;
}

function cleanUpText(aElem, aHidePrivateData) {
  let node = aElem.firstChild;
  while (node) {
    let className = ("className" in node && node.className) || "";
    // Delete uionly nodes.
    if (className.indexOf(CLASS_DATA_UIONLY) != -1) {
      // Advance to the next node before removing the current node, since
      // node.nextSibling is null after removeChild
      let nextNode = node.nextSibling;
      aElem.removeChild(node);
      node = nextNode;
      continue;
    }
    // Replace private data with a blank string
    else if (aHidePrivateData && className.indexOf(CLASS_DATA_PRIVATE) != -1) {
      node.textContent = "";
    }
    // Replace public data with a blank string
    else if (!aHidePrivateData && className.indexOf(CLASS_DATA_PUBLIC) != -1) {
      node.textContent = "";
    }
    else {
      // Replace localized text with non-localized text
      let copyData = node.getUserData("copyData");
      if (copyData != null)
        node.textContent = copyData;
    }

    if (node.nodeType == Node.ELEMENT_NODE)
      cleanUpText(node, aHidePrivateData);

    // Advance!
    node = node.nextSibling;
  }
}

// Return the plain text representation of an element.  Do a little bit
// of pretty-printing to make it human-readable.
function createTextForElement(elem, aHidePrivateData) {
  // Generate the initial text.
  let textFragmentAccumulator = [];
  generateTextForElement(elem, aHidePrivateData, "", textFragmentAccumulator);
  let text = textFragmentAccumulator.join("");

  // Trim extraneous whitespace before newlines, then squash extraneous
  // blank lines.
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n\n\n+/g, "\n\n");

  // Actual CR/LF pairs are needed for some Windows text editors.
  if ("@mozilla.org/windows-registry-key;1" in Cc)
    text = text.replace(/\n/g, "\r\n");

  return text;
}

/**
 * Elements to replace entirely with custom text. Keys are element ids, values
 * are functions that return the text.
 */
var gElementsToReplace = {
  "accounts-table": getAccountText,
  "extensions-table": getExtensionsText,
};

function generateTextForElement(elem, aHidePrivateData, indent,
                                textFragmentAccumulator) {
  // Add a little extra spacing around most elements.
  if (["td", "th", "span", "a"].indexOf(elem.tagName) == -1)
    textFragmentAccumulator.push("\n");

  // If this element is one of our elements to replace with text, do it.
  if (elem.id in gElementsToReplace) {
    let replaceFn = gElementsToReplace[elem.id];
    textFragmentAccumulator.push(replaceFn(aHidePrivateData, indent + "  "));
    return;
  };

  let childCount = elem.childElementCount;

  // We're not going to spread a two-column <tr> across multiple lines, so
  // handle that separately.
  if (elem.tagName == "tr" && childCount == 2) {
    textFragmentAccumulator.push(indent);
    textFragmentAccumulator.push(elem.children[0].textContent.trim() + ": " +
                                 elem.children[1].textContent.trim());
    return;
  }

  // Generate the text representation for each child node.
  let node = elem.firstChild;
  while (node) {
    if (node.nodeType == Node.TEXT_NODE) {
      // Text belonging to this element uses its indentation level.
      generateTextForTextNode(node, indent, textFragmentAccumulator);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
      // Recurse on the child element with an extra level of indentation (but
      // only if there's more than one child).
      generateTextForElement(node, aHidePrivateData,
                             indent + (childCount > 1 ? "  " : ""),
                             textFragmentAccumulator);
    }
    // Advance!
    node = node.nextSibling;
  }
}

function generateTextForTextNode(node, indent, textFragmentAccumulator) {
  // If the text node is the first of a run of text nodes, then start
  // a new line and add the initial indentation.
  let prevNode = node.previousSibling;
  if (!prevNode || prevNode.nodeType == Node.TEXT_NODE)
    textFragmentAccumulator.push("\n" + indent);

  // Trim the text node's text content and add proper indentation after
  // any internal line breaks.
  let text = node.textContent.trim().replace("\n", "\n" + indent, "g");
  textFragmentAccumulator.push(text);
}

function openProfileDirectory() {
  // Get the profile directory.
  let propertiesService = Cc["@mozilla.org/file/directory_service;1"]
                            .getService(Ci.nsIProperties);
  let currProfD = propertiesService.get("ProfD", Ci.nsIFile);
  let profileDir = currProfD.path;

  // Show the profile directory.
  let nsLocalFile = Components.Constructor("@mozilla.org/file/local;1",
                                           "nsILocalFile", "initWithPath");
  new nsLocalFile(profileDir).reveal();
}
