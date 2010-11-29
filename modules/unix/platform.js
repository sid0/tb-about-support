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
 * The Original Code is Thunderbird about:support.
 * 
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
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

"use strict";

var EXPORTED_SYMBOLS = ["AboutSupportPlatform"];

// JS ctypes are needed to get at the data we need
Components.utils.import("resource://gre/modules/ctypes.jsm");
const GFile = ctypes.StructType("GFile");
const GFileInfo = ctypes.StructType("GFileInfo");
const GError = ctypes.StructType("GError");
const GCancellable = ctypes.StructType("GCancellable");

const G_FILE_ATTRIBUTE_FILESYSTEM_TYPE = "filesystem::type";

// This is a tremendous abuse of generators, but it works
function g_free_generator() {
  let glib = ctypes.open("libglib-2.0.so");
  try {
    let g_free_fn = glib.declare(
      "g_free",
      ctypes.default_abi,
      ctypes.void,
      ctypes.voidptr_t
    );
    while (true) {
      let ptr = yield;
      g_free_fn(ptr);
    }
  }
  finally {
    glib.close();
  }
}

var g_free_gen = g_free_generator();
g_free_gen.next();
function g_free(aPtr) {
  g_free_gen.send(aPtr);
}

function g_object_unref_generator() {
  let glib = ctypes.open("libglib-2.0.so");
  try {
    let g_object_unref_fn = glib.declare(
      "g_object_unref",
      ctypes.default_abi,
      ctypes.void,
      ctypes.voidptr_t
    );
    while (true) {
      let ptr = yield;
      g_object_unref_fn(ptr);
    }
  }
  finally {
    glib.close();
  }
}

var g_object_unref_gen = g_object_unref_generator();
g_object_unref_gen.next();
function g_object_unref(aPtr) {
  g_object_unref_gen.send(aPtr);
}

var AboutSupportPlatform = {
  /**
   * Given an nsIFile, gets the file system type. The type is returned as a
   * string. Possible values are "Network", "Local", and in case the file system
   * isn't identifiable as either network or local, the file system identifier.
   */
  getFileSystemType: function ASPUnix_getFileSystemType(aFile) {
    let glib = ctypes.open("libglib-2.0.so");
    let gio = ctypes.open("libgio-2.0.so");
    try {
      // Given a UTF-8 string, converts it to the current Glib locale.
      let g_filename_from_utf8 = glib.declare(
        "g_filename_from_utf8",
        ctypes.default_abi,
        ctypes.char.ptr,   // return type: glib locale string
        ctypes.char.ptr,   // in: utf8string
        ctypes.ssize_t,    // in: len
        ctypes.size_t.ptr, // out: bytes_read
        ctypes.size_t.ptr, // out: bytes_written
        GError.ptr         // out: error
      );
      let filePath = g_filename_from_utf8(aFile.path, -1, null, null, null);
      if (filePath.isNull()) {
        throw new Error("Unable to convert " + aFile.path +
                        " into GLib encoding");
      }

      // Given a path, creates a new GFile for it.
      let g_file_new_for_path = gio.declare(
        "g_file_new_for_path",
        ctypes.default_abi,
        GFile.ptr,      // return type: a newly-allocated GFile
        ctypes.char.ptr // in: path
      );
      let glibFile = g_file_new_for_path(filePath);

      // Given a GFile, queries the given attributes and returns them
      // as a GFileInfo.
      let g_file_query_filesystem_info = gio.declare(
        "g_file_query_filesystem_info",
        ctypes.default_abi,
        GFileInfo.ptr,    // return type
        GFile.ptr,        // in: file
        ctypes.char.ptr,  // in: attributes
        GCancellable.ptr, // in: cancellable
        GError.ptr        // out: error
      );
      let glibFileInfo = g_file_query_filesystem_info(
        glibFile, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE, null, null);
      if (glibFileInfo.isNull()) {
        g_free(filePath);
        g_object_unref(glibFile);
      }

      let g_file_info_get_attribute_string = gio.declare(
        "g_file_info_get_attribute_string",
        ctypes.default_abi,
        ctypes.char.ptr, // return type: file system type
        GFileInfo.ptr,   // in: info
        ctypes.char.ptr  // in: attribute
      );
      let fsType = g_file_info_get_attribute_string(
        glibFileInfo, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE);
      g_free(filePath);
      g_object_unref(glibFile);
      g_object_unref(glibFileInfo);
      return fsType.readString();
    }
    finally {
      glib.close();
      gio.close();
    }
  },
};
