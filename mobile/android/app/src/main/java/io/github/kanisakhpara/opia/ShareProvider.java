package io.github.kanisakhpara.opia;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/**
 * Lets the app you share to read one file from Opia's outbox (cache/out), and nothing else. Read only.
 * A small stand-in for androidx FileProvider, so the app needs no libraries beyond Android itself.
 */
public class ShareProvider extends ContentProvider {
    static Uri uriFor(Context c, File f) {
        return new Uri.Builder().scheme("content").authority(c.getPackageName() + ".share").appendPath(f.getName()).build();
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        File dir = new File(getContext().getCacheDir(), "out"), f = new File(dir, name == null ? "" : name);
        try {
            if (name == null || !f.getCanonicalFile().getParentFile().equals(dir.getCanonicalFile()) || !f.isFile()) throw new FileNotFoundException(String.valueOf(name));
        } catch (IOException e) {
            throw new FileNotFoundException(String.valueOf(name));
        }
        return f;
    }

    @Override
    public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new SecurityException("read only");
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        String name = uri.getLastPathSegment(), ext = name == null ? "" : MimeTypeMap.getFileExtensionFromUrl(name.replace(' ', '_'));
        String t = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return t == null ? "application/octet-stream" : t;
    }

    /* name and size, which apps ask for before they read */
    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        File f;
        try { f = fileFor(uri); } catch (FileNotFoundException e) { return null; }
        String[] cols = projection != null ? projection : new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        MatrixCursor c = new MatrixCursor(cols);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
        }
        c.addRow(row);
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }

    @Override
    public int delete(Uri uri, String selection, String[] args) { return 0; }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
}
