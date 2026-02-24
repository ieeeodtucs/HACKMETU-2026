package tr.org.lider.entities;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * This model will be used to for role type.
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay Çolak</a>
 * 
 */
@Entity
@Table(name = "ROLE_TYPE")
public class RoleTypeImpl implements Serializable{

	private static final long serialVersionUID = -1346427613715034481L;

	@Id
	@GeneratedValue
	@Column(name = "ROLE_TYPE_ID", unique = true, nullable = false)
	private Long id;

	@Column(name = "NAME", nullable = false, unique = true)
	private String name;
	
	@Column(name = "CODE", nullable = true, unique = true)
	private String code;

	
	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "CREATE_DATE", nullable = false)
	@CreationTimestamp
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss")
	private Date createDate;

	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "MODIFY_DATE")
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss")
	private Date modifyDate;

	public RoleTypeImpl() {
	}

	public RoleTypeImpl(String name, String code) {
		this.name = name;
		this.code = code;
	}
	
	public RoleTypeImpl(Long id, String name, String code) {
		this.id = id;
		this.name = name;
		this.code = code;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Date getCreateDate() {
		return createDate;
	}

	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}

	public Date getModifyDate() {
		return modifyDate;
	}

	public void setModifyDate(Date modifyDate) {
		this.modifyDate = modifyDate;
	}

}
