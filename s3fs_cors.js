/**
 * @file
 * Javascript to enable client side uploading of files to S3.
 */

(function ($) {
  S3fsCORSUpload = {};
  Drupal.behaviors.S3fsCORSUpload = {};
  
  S3fsCORSUpload.handleUpload = function(form, triggering_element) {
    var file_input = $('.s3fs-cors-upload-file');
    var widget = file_input.parent();
    if (file_input[0].files === undefined || window.FormData === undefined) {
      // If the FormData API is unavailable, or we're in IE8/9, fall back to
      // a non-CORS upload.
      // TODO: Non-CORS upload.
      alert('Non-CORS');
      return;
    }
    
    // For now, we only support single-value file fields.
    var file_obj = file_input[0].files[0];
    
    // Replace the file <input> with a placeholder for our progress bar.
    file_input.hide().after($('<div>', {
      id: 's3fs-cors-progress',
      style: 'width: 270px; min-height: 2em; float: left; text-align: center; line-height: 2em; margin-right: 5px;',
      text: Drupal.t('Preparing upload ...'),
    }));
    
    var postData = {
      filename: file_obj.name,
      filemime: file_obj.type,
      // Need this to look up the form during our signing request.
      form_build_id: form.find('input[name="form_build_id"]').val()
    };
    
    // Ask Drupal to generate the appropriate signed request for us.
    $.post('/ajax/s3fs_cors', postData, function(data) {
      // Use the HTML5 FormData API to build a POST form to send to S3.
      var fd = new FormData();
      // Use the signed form data returnd from /ajax/s3fs_cors.
      $.each(data.inputs, function(key, value) {
        fd.append(key, value);
      });
      fd.append('file', file_obj);
      
      // Send the AJAX request to S3.
      $.ajax({
        // data.form.action is the S3 URL to which this upload will be POSTed.
        url: data.form.action,
        type: 'POST',
        mimeType: 'multipart/form-data',
        data: fd,
        cache: false,
        contentType: false,
        processData: false,
        xhrFields: {
          withCredentials: true
        },
        xhr: function() {
          myXhr = $.ajaxSettings.xhr();
          if (myXhr.upload) {
            myXhr.upload.addEventListener('progress', (function(e) {
              return S3fsCORSUpload.displayProgress(file_input, e);
            }), false);
          }
          return myXhr;
        },
        error: function() {
          // TODO: deal w/ upload errors.
          //console.log(arguments);
          // Re-enable all the submit buttons in the form.
          form.find('input[type="submit"]').prop('disabled', false);
        },
        complete: function() {
          // Update the hidden fields with the metadata for the file we just
          // uploaded.
          var widget = file_input.parent();
          widget.find('input.filemime').val(file_obj.type);
          widget.find('input.filesize').val(file_obj.size);
          // Use the filename provided by Drupal, as it may have been renamed.
          widget.find('input.filename').val(data.file_real);
          
          // Re-enable all the submit buttons in the form.
          form.find('input[type="submit"]').prop('disabled', false);
          
          // Now that the upload to S3 is complete, trigger the original
          // Drupal action for the Upload button, in order to to inform
          // Drupal of the file.
          // TODO: Only do this is the Upload button was the submission source.
          // Don't do it if the overall form's Save button was clicked first. But still remove the file from the form!
          // TODO: This line probably needs a tweak for multi-value file fields.
          var button_id = widget.find('input.cors-form-submit').attr('id');
          ajax = Drupal.ajax[button_id];
          
          // Avoid uploading the file itself to Drupal.
          var file_selector_id = file_input.attr('id');
          $(ajax.form[0]).find('#' + file_selector_id).remove();
          
          // Submit the form to Drupal.
          ajax.form.ajaxSubmit(ajax.options);
        } // End final form submit.
      }); // End S3 upload request.
    }); // End signing request
  };
  
  /**
   * Receives an XMLHttpRequestProgressEvent and uses it to display current
   * progress if possible.
   *
   * @param event
   *   And XMLHttpRequestProgressEvent object.
   */
  S3fsCORSUpload.displayProgress = function(element, event) {
    if (event.lengthComputable) {
      var progress = $('#s3fs-cors-progress');
      // Remove the placeholder text at the last possible moment. But don't mess
      // with progress.text after that, or we'll destroy the progress bar.
      if (progress.text() == Drupal.t('Preparing upload ...')) {
        progress.text('');
      }
      percent = Math.floor((event.loaded / event.total) * 100);
      progress.progressbar({value: percent});
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
