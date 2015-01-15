This module is a fork of AmazonS3 CORS Upload, re-written to work with the
S3 File System module, rather than AmazonS3.

===================
    INSTALLATON
===================
You must install the jQuery Update module and set it to use jQuery v1.5 or
higher. Otherwise, the CORS uploads will fail. Note that setting it higher
than 1.8 can cause backwards compatibility problems for other modules'
javascript code.

===================
       SETUP
===================
To configure your S3 bucket so that it will accept CORS uploads, go to the
admin/config/media/s3fs/cors page on your admin site, fill in the "CORS Origin"
field with your site's domain name, and submit it.

To enable the CORS Upload widget, create a new file field (or edit an existing
one) with the "S3 CORS File Upload" widget. This will change out the usual file
upload mechanism provided by Drupal with one that looks the same, but behaves
slightly differently when uploading files.

===================
   Known Issues
===================
CORS uploading is not supported in IE8 or 9. S3FS CORS Upload may same day
be redesigned to be able to fall back to a non-CORS solution in those ancient
browsers. Until then, you should strongly recommend that your users upgrade
to a modern browser. If they cannot, they might try using Google Chrome Frame,
which is a plugin for IE that makes it run as Chrome under the hood.

S3FS CORS also does not yet support multi-value file fields. If you need CORS
upload support for such fields, please post a feature request to the S3FS CORS
issue queue on drupal.org.
