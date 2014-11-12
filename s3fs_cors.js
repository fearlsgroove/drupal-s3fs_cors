/**
 * @file
 * Javascript to enable client side uploading of files to S3.
 */

(function ($) {
  S3fsCORSUpload = {};
  Drupal.behaviors.S3fsCORSUpload = {};
  
  S3fsCORSUpload.handleUpload = function(upload_button) {
    var form = upload_button.closest('form');
    var file_input = upload_button.siblings('.s3fs-cors-upload-file');
    var widget = file_input.parent();
    if (file_input[0].files === undefined || window.FormData === undefined) {
      // If we're in IE8/9, or the FormData API is unavailable, fall back to
      // a non-CORS upload.
      // TODO: Non-CORS upload.
      alert('CORS Upload is not supported in IE8 or 9. Sorry.');
      return;
    }
    
    // For now, we only support single-value file fields.
    var file_obj = file_input[0].files[0];
    
    // Disable all the submit buttons, so users can't accidentally mess
    // up the workflow. We'll submit the form via JS after file uploads
    // are complete.
    form.find('input[type="submit"]').prop('disabled', 'disabled');
    
    var progress_bar = $('<div>', {
      id: 's3fs-cors-progress',
      style: 'width: 270px; min-height: 2em; float: left; text-align: center; line-height: 2em; margin-right: 5px;',
      text: Drupal.t('Preparing upload ...'),
    })

    // Replace the file <input> with a placeholder for our progress bar.
    file_input.hide().after(progress_bar);
    
    // This function undoes the form alterations we made.
    var form_cleanup = function() {
      file_input.show();
      progress_bar.remove();
      form.find('input[type="submit"]').prop('disabled', false);
    }
    
    // The name of the file that Drupal returns from the signing request.
    // We declare it here so that submit_to_drupal can access it.
    var file_real = null;

    // Step 3: Do the usual ajax submission to Drupal for file uploads, minus
    // the actual file data.
    var submit_to_drupal = function(data, textStatus, jqXHR) {
      // Update the hidden fields with the metadata for the file we just
      // uploaded.
      widget.find('input.filemime').val(file_obj.type);
      widget.find('input.filesize').val(file_obj.size);
      widget.find('input.filename').val(file_real);
      
      // Re-enable all the submit buttons in the form.
      form.find('input[type="submit"]').prop('disabled', false);
      
      // Now that the upload to S3 is complete, trigger the original
      // Drupal action for the Upload button, in order to to inform
      // Drupal of the file.
      // TODO: Only do this is the Upload button was the submission source.
      // Don't do it if the overall form's Save button was clicked first. But still remove the file from the form!
      // TODO: This line probably needs a tweak for multi-value file fields.
      var button_id = widget.find('input.cors-form-submit').attr('id');
      var ajax = Drupal.ajax[button_id];
      
      // Avoid uploading the file to Drupal.
      $(ajax.form[0]).find('#' + file_input.attr('id')).remove();
      
      // Submit the form to Drupal.
      ajax.form.ajaxSubmit(ajax.options);
    };

    // Step 2: With the signed form data, perform the CORS upload to S3.
    var upload_to_s3 = function(data, textStatus, jqXHR) {
      // Use the HTML5 FormData API to build a POST form to send to S3.
      var fd = new FormData();
      // Use the signed form data returnd from /ajax/s3fs_cors.
      $.each(data.inputs, function(key, value) {
        fd.append(key, value);
      });
      fd.append('file', file_obj);
      // Save the filename returned from Drupal so that submit_to_drupal()
      // can access it.
      file_real = data.file_real;

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
          // Alter the XMLHTTPRequest to make it use our progressbar code.
          var the_xhr = $.ajaxSettings.xhr();
          if (the_xhr.upload) {
            the_xhr.upload.onprogress = S3fsCORSUpload.displayProgress;
          }
          return the_xhr;
        },
        error: function(jqXHR, textStatus, errorThrown) {
          // TODO: deal w/ upload errors.
          //console.log(arguments);
          form_cleanup();
        },
        complete: submit_to_drupal
      });
    };
    
    // Here's where the three-step workflow starts:
    // Step 1: Get the signed S3 upload form from Drupal.
    $.ajax({
      url: '/ajax/s3fs_cors',
      type: 'POST',
      data: {
        filename: file_obj.name,
        filemime: file_obj.type,
        // Need this to look up the form during our signing request.
        form_build_id: form.find('input[name="form_build_id"]').val()
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert('An error occured while preparing to upload the file to S3:\n' + jqXHR.responseJSON.error);
        form_cleanup();
      },
      success: upload_to_s3,
    });
  };
  
  /**
   * Handle the form submit action by performing the upload AJAX first,
   * then submitting the full form.
   */
  S3fsCORSUpload.handleSubmit = function(form) {
    // TODO: Need to loop through all .s3fs-cors-upload-file objects, in case
    // there is more than one CORS Upload file field.
    $('.s3fs-cors-upload-file', form).each(function(ndx, file_input) {
      file_input = $(file_input);
      var widget = file_input.parent();

      // Don't do anything with an empty <input>.
      if (!file_input.val()) {
        return;
      }
      
      if (file_input[0].files === undefined || window.FormData === undefined) {
        // If we're in IE8/9, or the FormData API is unavailable, fall back to
        // a non-CORS upload.
        // TODO: Non-CORS upload.
        alert('CORS Upload is not supported in IE8 or 9. Sorry.');
        return;
      }
      
      // For now, we only support single-value file fields.
      var file_obj = file_input[0].files[0];
      
      // Disable all the submit buttons, so users can't accidentally mess
      // up the workflow. We'll submit the form via JS after file uploads
      // are complete.
      form.find('input[type="submit"]').prop('disabled', 'disabled');
      
      var progress_bar = $('<div>', {
        id: 's3fs-cors-progress',
        style: 'width: 270px; min-height: 2em; float: left; text-align: center; line-height: 2em; margin-right: 5px;',
        text: Drupal.t('Preparing upload ...'),
      })

      // Replace the file <input> with a placeholder for our progress bar.
      file_input.hide().after(progress_bar);
      
      // This function undoes the form alterations we made.
      var form_cleanup = function() {
        file_input.show();
        progress_bar.remove();
        form.find('input[type="submit"]').prop('disabled', false);
      }
      
      // The name of the file that Drupal returns from the signing request.
      // We declare it here so that submit_to_drupal can access it.
      var file_real = null;

      // Step 3: Do the usual ajax submission to Drupal for file uploads, minus
      // the actual file data.
      var submit_to_drupal = function(data, textStatus, jqXHR) {
        // Update the hidden fields with the metadata for the file we just
        // uploaded.
        widget.find('input.filemime').val(file_obj.type);
        widget.find('input.filesize').val(file_obj.size);
        widget.find('input.filename').val(file_real);
        
        // Perform the full node submission by removing our submit handler.
        form.unbind('submit');
        form.submit();
      };

      // Step 2: With the signed form data, perform the CORS upload to S3.
      var upload_to_s3 = function(data, textStatus, jqXHR) {
        // Use the HTML5 FormData API to build a POST form to send to S3.
        var fd = new FormData();
        // Use the signed form data returnd from /ajax/s3fs_cors.
        $.each(data.inputs, function(key, value) {
          fd.append(key, value);
        });
        fd.append('file', file_obj);
        // Save the filename returned from Drupal so that submit_to_drupal()
        // can access it.
        file_real = data.file_real;

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
            // Alter the XMLHTTPRequest to make it use our progressbar code.
            var the_xhr = $.ajaxSettings.xhr();
            if (the_xhr.upload) {
              the_xhr.upload.onprogress = S3fsCORSUpload.displayProgress;
            }
            return the_xhr;
          },
          error: function(jqXHR, textStatus, errorThrown) {
            // TODO: deal w/ upload errors.
            //console.log(arguments);
            form_cleanup();
          },
          complete: submit_to_drupal
        });
      };
      
      // Here's where the three-step workflow starts:
      // Step 1: Get the signed S3 upload form from Drupal.
      $.ajax({
        url: '/ajax/s3fs_cors',
        type: 'POST',
        data: {
          filename: file_obj.name,
          filemime: file_obj.type,
          // Need this to look up the form during our signing request.
          form_build_id: form.find('input[name="form_build_id"]').val()
        },
        error: function(jqXHR, textStatus, errorThrown) {
          alert('An error occured while preparing to upload the file to S3:\n' + jqXHR.responseJSON.error);
          form_cleanup();
        },
        success: upload_to_s3,
      });
    });
  };

  /**
   * Receives an XMLHttpRequestProgressEvent and uses it to display current
   * progress if possible.
   *
   * @param event
   *   And XMLHttpRequestProgressEvent object.
   */
  S3fsCORSUpload.displayProgress = function(event) {
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
    var upload_button = $('input.cors-form-submit', context);
    // We need to use jQuery.once() here because Drupal runs the attach function
    // multiple times for some reason.
    upload_button.once('s3fs_cors_upload', function() {
      // Prevent Drupal's AJAX file upload code from running.
      upload_button.unbind('mousedown');
      
      // Run our own AJAX file upload code when the user clicks the Upload button.
      // Since this attach function will get run again the next time the Upload button
      // appears, we can use jQuery.one() to ensure that the user doesn't accidentally
      // start the upload multiple times.
      upload_button.one('click', function(e) {
        S3fsCORSUpload.handleUpload($(this));
        return false;
      });
    });

    $('form.s3fs-cors-upload-form', context).once('s3fs_cors_form', function() {
      $(this).submit(function(event) {
        var uploads_needed = false;
        $('input.s3fs-cors-upload-file', this).each(function(ndx, file_input) {
          file_input = $(file_input);
          if (file_input.val()) {
            uploads_needed = true;
          }
        });
        // If there are no filled CORS input elements to perform uploads for,
        // fall through to the normal form submission.
        if (uploads_needed) {
          event.preventDefault();
          event.stopPropagation();
          S3fsCORSUpload.handleSubmit($(this));
          return false;
        }
        return true;
      });
    });
  };
})(jQuery);
