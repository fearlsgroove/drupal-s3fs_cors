This module is a fork of AmazonS3 CORS Upload, re-written to work with the
S3 File System module, rather than AmazonS3.

You must install the jQuery Update module and set it to use jQuery v1.5 or
later. Otherwise, the CORS uploads will fail.

To configure your S3 bucket so that it will accept CORS uploads, go to the
admin/config/media/s3fs_cors page on your admin site, fill in the "CORS Origin"
field with your site's domain name, and submit it.
