/**
 * @file
 * Javascript to enable client side uploading of files to S3.
 */

(function ($) {
  S3fsCORSUpload = {};
  Drupal.behaviors.S3fsCORSUpload = {};
  
  S3fsCORSUpload.handleUpload = function(form, triggering_element) {
    // Retrieve the file object.
    var file = $('.s3fs-cors-upload-file');
    var file_obj = file[0].files[0];
    // And the form_build_id which we need to lookup the form during our AJAX
    // request.
    var form_build_id = form.find('input[name="form_build_id"]').val();
    if (typeof file_obj != 'undefined') {
      // Add a placholder for our progress bar.
      file.hide().after('<div id="s3fs-cors-progress" style="width: 270px; float: left;">' + Drupal.t('Preparing upload ...') + '</div>');
      
      // Use the file object and ask Drupal to generate the appropriate signed
      // request for us.
      var postData = {
        filename: file_obj.name,
        filesize: file_obj.size,
        filemime: file_obj.type,
        triggering_element: triggering_element,
        form_build_id: form_build_id
      };
      
      // Send a POST to Drupal to get back the required paramaters for signing
      // a CORS request.
      $.post(Drupal.settings.basePath + 'ajax/s3fs_cors', postData, function(data) {
        // Take the signed data and construct a form out of it.
        var fd = new FormData();
        $.each(data.inputs, function(key, value) {
          fd.append(key, value);
        });
        
        // Add the file to be uploaded.
        fd.append('file', file_obj);
        
        // Execute the AJAX request to S3.
        $.ajax({
          // Use a protocol-relative URL for the POST target, to avoid browser complaints.
          url: data.form.action,
          processData: false,
          data: fd,
          type: 'POST',
          cache: false,
          contentType: false,
          mimeType: 'multipart/form-data',
          // This works with jQuery 1.5.1+, however the withCredentials doesn't
          // stick w/ older versions. So we handle it in the beforeSend method.
          xhrFields: {
            withCredentials: true
          },
          xhr: function() {
            myXhr = $.ajaxSettings.xhr();
            if (myXhr.upload) {
              $('#s3fs-cors-progress').html('');
              myXhr.upload.addEventListener('progress', (function(e) {
                return S3fsCORSUpload.displayProgress(file, e);
              }), false);
            }
            return myXhr;
          },
          error: function() {
            // TODO: deal w/ upload errors.
            console.log(arguments);
          },
          complete: function() {
            // Update the hidden fields to tell Drupal about the file that
            // was just uploaded.
            file.parent().find('input[name$="[filemime]"]').val(file_obj.type);
            file.parent().find('input[name$="[filesize]"]').val(file_obj.size);
            // Make sure and use the filename provided by Drupal as it may have
            // been renamed.
            file.parent().find('input[name$="[filename]"]').val(data.file_real);
            // Re-enable all the submit buttons.
            form.find('input[type="submit"]').prop('disabled', false);
            // Trigger the #ajax method for the upload button that was
            // initially clicked to upload the file.
            var button_id = file.parent().find('input.cors-form-submit').attr('id');
            ajax = Drupal.ajax[button_id];
            // Prevent Drupal from transferring the file twice as part of the
            // form rebuild.
            var file_selector_id = file.attr('id');
            $(ajax.form[0]).find('#' + file_selector_id).remove();

            ajax.form.ajaxSubmit(ajax.options);
          }
        });
      });
    }
    else {
      form.submit();
    }
  };
  
  /**
   * Receives an XMLHttpRequestProgressEvent and uses it to display current
   * progress if possible.
   *
   * @param event
   *   And XMLHttpRequestProgressEvent object.
   */
  S3fsCORSUpload.displayProgress = function(el, event) {
    if (event.lengthComputable) {
      percent = Math.floor((event.loaded / event.total) * 100);
      $('#s3fs-cors-progress').progressbar({value: percent});
      return true;
    }
  };
  
  /**
   * Implements Drupal.behaviors.
   */
  Drupal.behaviors.S3fsCORSUpload.attach = function(context, settings) {
    var upload_button = $('form.s3fs-cors-upload-form input.cors-form-submit', context);
    // This takes care of preventing Drupal's AJAX framework.
    // TODO: What about pressing ENTER?
    upload_button.unbind('mousedown');
    
    // Intercept click events for submit buttons in forms with a CORS upload
    // field so we can process the upload to S3 and then actually submit the
    // form when it's all taken care of.
    // TODO: Again, what about pressing ENTER? Probably need to override the submit action
    // rather than these click events.
    upload_button.one('click', function(e) {
      var form = $(this).parents('form');
      
      // Disable all the submit buttons, we'll submit the form via JS after
      // file uploads are complete.
      form.find('input[type="submit"]').prop('disabled', 'disabled');
      
      S3fsCORSUpload.handleUpload(form, $(this).attr('name'));
      return false;
    });
  };
})(jQuery);
