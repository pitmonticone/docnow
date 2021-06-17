import React from 'react'
import PropTypes from 'prop-types'

/*
import sh_c_cg from '../images/social-humans/sh-c-cg'
import sh_c_da from '../images/social-humans/sh-c-da'
import sh_c_ea from '../images/social-humans/sh-c-ea'
import sh_c_rl from '../images/social-humans/sh-c-rl'
import sh_c_rn from '../images/social-humans/sh-c-rn'
import sh_c_rm from '../images/social-humans/sh-c-rm'
import sh_c_am from '../images/social-humans/sh-c-am'
import sh_c_cm from '../images/social-humans/sh-c-cm'
*/

const labels = [
  "sh-c-cg",
  "sh-c-da",
  "sh-c-ea",
  "sh-c-rl",
  "sh-c-rn",
  "sh-c-rm",
  "sh-c-am",
  "sh-c-cm",
]

const labelNames = {
  "sh-c-am": "Anonymize Me",
  "sh-c-cg": "Consent Granted",
  "sh-c-cm": "Credit Me",
  "sh-c-da": "Delay Access",
  "sh-c-ea": "Expire Access",
  "sh-c-rl": "Remove Location",
  "sh-c-rm": "Remove Media",
  "sh-c-rn": "Remove Network"
}

const labelDescriptions = {
  "sh-c-am": "I would like to be anonymized in the archive.",
  "sh-c-cg": "I consent to having my content archived",
  "sh-c-cm": "I would like to be credited in all presentations of the archive",
  "sh-c-da": "I would like access to my content to be delayed",
  "sh-c-ea": "I would like access to my contnent to expire",
  "sh-c-rl": "I would like my location to be removed from content",
  "sh-c-rm": "I would like all media to be removed from my content",
  "sh-c-rn": "I would like my social media network connectsion to be removed"
}

const Label = props => {
  return (
    <img
      className="Label" 
      alt={labelNames[props.name]}
      title={labelDescriptions[props.name]}
      src={require(`../images/social-humans/${props.name}.jpg`)} />
  )
}

Label.propTypes = {
  name: PropTypes.string
}

export {
  Label,
  labels,
  labelNames
}