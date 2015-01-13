This module is a fork of AmazonS3 CORS Upload, re-written to work with the
S3 File System module, rather than AmazonS3.

You must install the jQuery Update module and set it to use jQuery v1.5 or
later. Otherwise, the CORS uploads will fail.

To configure your S3 bucket so that it will accept CORS uploads, go to the
admin/config/media/s3fs/cors page on your admin site, fill in the "CORS Origin"
field with your site's domain name, and submit it.

============
Known Issues
============
CORS uploading is not supported in IE8 or 9. Eventually, S3FS CORS Upload may
be redesigned to be able to fall back to a non-CORS solution in those ancient
browsers. Until then, you should strongly recommend that your users upgrade
to a modern browser. If they cannot, they might try using Google Chrome Frame,
which is a plugin for IE that makes it run as Chrome under the hood.
