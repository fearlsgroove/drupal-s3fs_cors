This module is a fork of AmazonS3 CORS Upload, re-written to work with the
S3 File System module, rather than AmazonS3.

You must install the jQuery Update module and set it to use jQuery v1.5 or
later. Otherwise, the CORS uploads will fail.

To configure your S3 bucket so that it will accept CORS uploads, go to the
admin/config/media/s3fs_cors page on your admin site, fill in the "CORS Origin"
field with your site's domain name, and submit it.

============
Known Issues
============
CORS uploading is not possible in IE8 or 9. However, S3FS CORS Upload will
gracefully fall back to a non-CORS solution in those ancient browsers. This
does mean your Drupal server will be taxed more by users of IE8/9 uploading
files, though. You might want to recommend that they upgrade to a modern
browser.
